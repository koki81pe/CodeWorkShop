// MOD-001: ENCABEZADO [INICIO]
/* *****************************************
PROYECTO: CodeWorkShop
ARCHIVO: code.gs
VERSIÓN: 01.09
FECHA: 13/01/2026 19:14 (UTC-5)
***************************************** */
// MOD-001: FIN

// MOD-002: FORZAR PERMISOS [INICIO]
/**
 * Esta función DEBE ejecutarse manualmente una vez desde el editor
 * antes de desplegar la webapp para activar el flujo de autorización
 */
function forzarPermisos() {
  try {
    DriveApp.getRootFolder().getName();
    Logger.log('✅ Permiso Drive autorizado');
  } catch (e) {
    Logger.log('❌ Esperando autorización de Drive: ' + e);
    throw new Error('Autoriza Drive y vuelve a ejecutar');
  }
  
  try {
    SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('✅ Permiso Spreadsheet autorizado');
  } catch (e) {
    Logger.log('⚠️ Spreadsheet no disponible (normal si no hay hoja activa)');
  }
  
  try {
    ScriptApp.getService().getUrl();
    Logger.log('✅ ScriptApp disponible');
  } catch (e) {
    Logger.log('❌ Error con ScriptApp: ' + e);
  }
  
  try {
    DocumentApp.openById('1vbbaAPpTN9nQed_OOtoQBIp9K3PfNn5wgXWhNELAhqA');
    Logger.log('✅ Permiso DocumentApp autorizado');
  } catch (e) {
    Logger.log('❌ Esperando autorización de DocumentApp: ' + e);
    throw new Error('Autoriza DocumentApp y vuelve a ejecutar');
  }
  
  Logger.log('✅ Permisos verificados. Ahora puedes desplegar la webapp.');
  return '✅ Permisos verificados correctamente';
}
// MOD-002: FIN

// MOD-003: SERVIR HTML [INICIO]
function doGet(e) {
  const page = e.parameter.page || 'index';
  
  if (page === 'test') {
    return HtmlService.createHtmlOutputFromFile('testweb')
      .setTitle('CodeWorkShop - Tests')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('CodeWorkShop')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// MOD-003: FIN

// MOD-004: INCLUIR ARCHIVOS HTML [INICIO]
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
// MOD-004: FIN

// MOD-005: DETECTAR TIPO DE ARCHIVO [INICIO]
/**
 * Detecta si el código es .GS o .HTML basándose en su contenido
 * @param {string} codigo - El código completo a analizar
 * @return {string} 'gs' o 'html'
 */
function detectarTipoArchivo(codigo) {
  // Si contiene comentarios HTML de módulo, es HTML
  if (/<!--\s*MOD-\d{3}:/i.test(codigo)) {
    return 'html';
  }
  
  // Si contiene comentarios JS de módulo, es GS
  if (/\/\/\s*MOD-\d{3}:/i.test(codigo)) {
    return 'gs';
  }
  
  // Fallback: detectar por tags HTML
  if (/<html|<script|<style|<!DOCTYPE/i.test(codigo)) {
    return 'html';
  }
  
  // Por defecto, asumimos GS
  return 'gs';
}
// MOD-005: FIN

// MOD-006: PARSEAR MÓDULOS [INICIO]
/**
 * Parsea módulos del código detectando automáticamente el tipo de archivo
 * Soporta archivos .GS (// comentarios) y .HTML (<!-- comentarios -->)
 */
function parsearModulos(codigoCompleto) {
  try {
    if (!codigoCompleto || codigoCompleto.trim() === '') {
      return { success: false, error: 'Código vacío' };
    }
    
    const tipoArchivo = detectarTipoArchivo(codigoCompleto);
    Logger.log('📄 Tipo de archivo detectado: ' + tipoArchivo.toUpperCase());
    
    let modulosRegex;
    
    if (tipoArchivo === 'html') {
      // Regex para archivos HTML: <!-- MOD-XXX: ... [INICIO] --> ... <!-- MOD-XXX: FIN -->
      modulosRegex = /<!--\s*MOD-(\d{3}):\s*(.+?)\s*\[INICIO\]\s*-->([\s\S]*?)<!--\s*MOD-\1:\s*FIN\s*-->/g;
    } else {
      // Regex para archivos GS: // MOD-XXX: ... [INICIO] ... // MOD-XXX: FIN
      modulosRegex = /\/\/\s*MOD-(\d{3}):\s*(.+?)\s*\[INICIO\]([\s\S]*?)\/\/\s*MOD-\1:\s*FIN/g;
    }
    
    const modulos = [];
    let match;
    
    while ((match = modulosRegex.exec(codigoCompleto)) !== null) {
      modulos.push({
        numero: match[1],
        descripcion: match[2].trim(),
        codigo: match[0],
        inicio: match.index,
        fin: match.index + match[0].length,
        tipo: tipoArchivo
      });
    }
    
    if (modulos.length === 0) {
      return { success: false, error: 'No se detectaron módulos válidos' };
    }
    
    Logger.log('✅ Módulos parseados: ' + modulos.length + ' (tipo: ' + tipoArchivo + ')');
    return { success: true, modulos: modulos, tipo: tipoArchivo };
    
  } catch (error) {
    Logger.log('❌ Error en parsearModulos: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-006: FIN

// MOD-007: EXTRAER HEADER [INICIO]
/**
 * Extrae el header del código, soportando ambos formatos (.GS y .HTML)
 */
function extraerHeader(codigoCompleto) {
  try {
    const tipoArchivo = detectarTipoArchivo(codigoCompleto);
    
    let headerRegex;
    
    if (tipoArchivo === 'html') {
      // Header en HTML: <!-- ... -->
      headerRegex = /<!--\s*\*+\s*PROYECTO:\s*(.+?)\s*ARCHIVO:\s*(.+?)\s*VERSIÓN:\s*(.+?)\s*FECHA:\s*(.+?)\s*\*+\s*-->/s;
    } else {
      // Header en GS: /* ... */
      headerRegex = /\/\*\s*\*+\s*PROYECTO:\s*(.+?)\s*ARCHIVO:\s*(.+?)\s*VERSIÓN:\s*(.+?)\s*FECHA:\s*(.+?)\s*\*+\s*\*\//s;
    }
    
    const match = codigoCompleto.match(headerRegex);
    
    if (!match) {
      return { success: false, error: 'Header no encontrado' };
    }
    
    const header = {
      proyecto: match[1].trim(),
      archivo: match[2].trim(),
      version: match[3].trim(),
      fecha: match[4].trim(),
      tipo: tipoArchivo
    };
    
    Logger.log('✅ Header extraído: ' + header.proyecto + ' (tipo: ' + tipoArchivo + ')');
    return { success: true, header: header };
    
  } catch (error) {
    Logger.log('❌ Error en extraerHeader: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-007: FIN

// MOD-008: VALIDAR MÓDULO [INICIO]
/**
 * Valida que un módulo tenga el formato correcto según su tipo
 */
function validarModulo(codigoModulo, numeroEsperado) {
  try {
    const tipoArchivo = detectarTipoArchivo(codigoModulo);
    
    let inicioRegex, finRegex;
    
    if (tipoArchivo === 'html') {
      // Validación para HTML
      inicioRegex = new RegExp(`<!--\\s*MOD-${numeroEsperado}:\\s*.+?\\s*\\[INICIO\\]\\s*-->`);
      finRegex = new RegExp(`<!--\\s*MOD-${numeroEsperado}:\\s*FIN\\s*-->`);
    } else {
      // Validación para GS
      inicioRegex = new RegExp(`\\/\\/\\s*MOD-${numeroEsperado}:\\s*.+?\\s*\\[INICIO\\]`);
      finRegex = new RegExp(`\\/\\/\\s*MOD-${numeroEsperado}:\\s*FIN`);
    }
    
    if (!inicioRegex.test(codigoModulo)) {
      return { success: false, error: `Falta [INICIO] en MOD-${numeroEsperado}` };
    }
    
    if (!finRegex.test(codigoModulo)) {
      return { success: false, error: `Falta FIN en MOD-${numeroEsperado}` };
    }
    
    return { success: true };
    
  } catch (error) {
    Logger.log('❌ Error en validarModulo: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-008: FIN

// MOD-009: REEMPLAZAR MÓDULO [INICIO]
/**
 * Reemplaza un módulo específico en el código
 * Detecta automáticamente el tipo de archivo y usa el formato correcto
 */
function reemplazarModulo(codigoCompleto, numeroModulo, nuevoCodigoModulo) {
  try {
    if (!codigoCompleto || !numeroModulo || !nuevoCodigoModulo) {
      return { success: false, error: 'Parámetros incompletos' };
    }
    
    const validacion = validarModulo(nuevoCodigoModulo, numeroModulo);
    if (!validacion.success) {
      return validacion;
    }
    
    const tipoArchivo = detectarTipoArchivo(codigoCompleto);
    let moduloRegex;
    
    if (tipoArchivo === 'html') {
      // Regex para HTML
      moduloRegex = new RegExp(
        `<!--\\s*MOD-${numeroModulo}:\\s*.+?\\s*\\[INICIO\\]\\s*-->[\\s\\S]*?<!--\\s*MOD-${numeroModulo}:\\s*FIN\\s*-->`,
        'g'
      );
    } else {
      // Regex para GS
      moduloRegex = new RegExp(
        `\\/\\/\\s*MOD-${numeroModulo}:\\s*.+?\\s*\\[INICIO\\][\\s\\S]*?\\/\\/\\s*MOD-${numeroModulo}:\\s*FIN`,
        'g'
      );
    }
    
    if (!moduloRegex.test(codigoCompleto)) {
      return { success: false, error: `Módulo MOD-${numeroModulo} no encontrado en el código original` };
    }
    
    const codigoActualizado = codigoCompleto.replace(moduloRegex, nuevoCodigoModulo.trim());
    
    const headerResult = extraerHeader(codigoCompleto);
    if (headerResult.success) {
      const codigoConVersionActualizada = actualizarVersion(codigoActualizado, headerResult.header);
      Logger.log('✅ Módulo MOD-' + numeroModulo + ' reemplazado exitosamente');
      return { success: true, codigo: codigoConVersionActualizada };
    }
    
    Logger.log('✅ Módulo MOD-' + numeroModulo + ' reemplazado (sin actualizar versión)');
    return { success: true, codigo: codigoActualizado };
    
  } catch (error) {
    Logger.log('❌ Error en reemplazarModulo: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-009: FIN

// MOD-010: ACTUALIZAR VERSIÓN [INICIO]
/*
 * Actualiza automáticamente la sección de encabezado con nueva versión y fecha
 * sin incluir segundos para evitar valores undefined.
 *
 * @param {string} codigo - Texto completo del código donde se activará el reemplazo
 * @param {Object} headerActual - Información extraída del header actual (proyecto, archivo, versión, tipo)
 * @returns {string} - Código completo con nuevo encabezado actualizado
 */
function actualizarVersion(codigo, headerActual) {
  try {
    // Extraer partes de version actual
    const versionParts = headerActual.version.split('.');
    if (versionParts.length === 2) {
      // Incrementar la parte menor de la versión
      versionParts[1] = String(parseInt(versionParts[1], 10) + 1).padStart(2, '0');
      const nuevaVersion = versionParts.join('.');

      // Obtener fecha y hora sin segundos
      const now = new Date();
      const TZ = 'America/Lima';

      const dia  = Utilities.formatDate(now, TZ, 'dd');
      const mes  = Utilities.formatDate(now, TZ, 'MM');
      const ano  = Utilities.formatDate(now, TZ, 'yyyy');
      const hora = Utilities.formatDate(now, TZ, 'HH');
      const min  = Utilities.formatDate(now, TZ, 'mm');

      const nuevaFecha = `${dia}/${mes}/${ano} ${hora}:${min} (UTC-5)`;

      let headerRegex, nuevoHeader;

      // Construir encabezado dependiendo de tipo de archivo (.gs o .html)
      if (headerActual.tipo === 'html') {
        headerRegex = /<!--[\s\S]*?-->/;
        nuevoHeader =
`<!-- *****************************************
PROYECTO: ${headerActual.proyecto}
ARCHIVO: ${headerActual.archivo}
VERSIÓN: ${nuevaVersion}
FECHA: ${nuevaFecha}
***************************************** -->`;
      } else {
        headerRegex = /\/\*\s*\*+[\s\S]*?\*+\s*\*\//;
        nuevoHeader =
`/* *****************************************
PROYECTO: ${headerActual.proyecto}
ARCHIVO: ${headerActual.archivo}
VERSIÓN: ${nuevaVersion}
FECHA: ${nuevaFecha}
***************************************** */`;
      }

      // Reemplazar encabezado antiguo con el nuevo
      const codigoActualizado = codigo.replace(headerRegex, nuevoHeader);

      Logger.log(`📌 Encabezado actualizado: ${headerActual.version} → ${nuevaVersion}`);
      return codigoActualizado;
    }

    // Si no coincide con el formato esperado de versión, no se modifica
    return codigo;

  } catch (e) {
    Logger.log('⚠️ Error actualizando versión/fecha: ' + e.message);
    return codigo;
  }
}
// MOD-010: FIN

// MOD-011: OBTENER URL DE TESTS [INICIO]
function obtenerURLTests() {
  try {
    const url = ScriptApp.getService().getUrl();
    if (url) {
      Logger.log('✅ URL obtenida: ' + url);
      return url + '?page=test';
    }
    Logger.log('❌ ScriptApp.getService().getUrl() devolvió null');
    return null;
  } catch (error) {
    Logger.log('❌ Error al obtener URL: ' + error.message);
    return null;
  }
}
// MOD-011: FIN

// MOD-012: OBTENER ESTÁNDAR DESDE GOOGLE DOC [INICIO]
function obtenerEstandar() {
  try {
    const docId = '1vbbaAPpTN9nQed_OOtoQBIp9K3PfNn5wgXWhNELAhqA';
    const doc = DocumentApp.openById(docId);
    const texto = doc.getBody().getText();
    
    if (!texto || texto.trim() === '') {
      return { success: false, error: 'El documento está vacío' };
    }
    
    Logger.log('✅ Estándar obtenido desde Google Doc (' + texto.length + ' caracteres)');
    return { success: true, texto: texto };
    
  } catch (error) {
    Logger.log('❌ Error al obtener estándar: ' + error.message);
    return { success: false, error: 'No se pudo leer el documento. Verifica los permisos.' };
  }
}
// MOD-012: FIN

// MOD-013: CÓDIGO DE CIERRE [INICIO]
// Sistema iniciado
Logger.log('✅ CodeWorkShop Backend v01.07 cargado');
Logger.log('📋 Soporta archivos .GS y .HTML (CodeWorkshop v2.2)');
// MOD-013: FIN

// MOD-014: NOTAS [INICIO]
/*
DESCRIPCIÓN:
Backend principal de CodeWorkShop para parseo, validación y reemplazo
de módulos en código modular. Ahora soporta AMBOS formatos según 
estándar CodeWorkshop v2.2:
- Archivos .GS: usa // para comentarios
- Archivos .HTML: usa <!-- --> para comentarios

CAMBIOS EN v01.09 (CRÍTICO):
- Se corrigió la generación del encabezado para eliminar los segundos inexistentes en el timestamp.

DEPENDENCIAS:
- MOD-003: Requiere archivos HTML (index, style, scripts, testweb)
- MOD-005: Clave para detectar tipo de archivo automáticamente
- MOD-006: Usa MOD-005 para seleccionar regex correcta
- MOD-009: Usa MOD-005, MOD-006, MOD-007, MOD-008 y MOD-010
- MOD-012: Requiere acceso a Google Docs API

ADVERTENCIAS:
- MOD-002: Debe ejecutarse manualmente antes del primer deploy
- MOD-005: La detección de tipo se basa en patrones de comentarios MOD-XXX
- MOD-006: Si no detecta módulos, verifica que usen el formato correcto
- MOD-010: Solo funciona con versiones formato XX.YY (dos secciones)
- MOD-012: Requiere que el documento esté compartido correctamente

EJEMPLOS DE USO:
// Para archivo .GS
parsearModulos(codigoGS); // Detecta automáticamente y usa // regex

// Para archivo .HTML  
parsearModulos(codigoHTML); // Detecta automáticamente y usa <!-- --> regex

PRÓXIMAS MEJORAS:
- Implementar validación de tabulación en módulos
- Agregar detección automática de módulo de NOTAS
- Cache del estándar para reducir llamadas a Google Docs
- Soporte para archivos mixtos (edge cases complejos)
*/
// MOD-014: FIN
