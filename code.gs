/******************************************
PROYECTO: CodeWorkShop
ARCHIVO: code.gs
VERSIÓN: 01.06
FECHA: 10/01/2026 (UTC-5)
******************************************/

// MOD-001: FORZAR PERMISOS [INICIO]
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
  
  // Verificar acceso a Google Docs
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
// MOD-001: FIN

// MOD-002: SERVIR HTML [INICIO]
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
// MOD-002: FIN

// MOD-003: INCLUIR ARCHIVOS HTML [INICIO]
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
// MOD-003: FIN

// MOD-004: PARSEAR MÓDULOS [INICIO]
function parsearModulos(codigoCompleto) {
  try {
    if (!codigoCompleto || codigoCompleto.trim() === '') {
      return { success: false, error: 'Código vacío' };
    }
    
    const modulosRegex = /\/\/\s*MOD-(\d{3}):\s*(.+?)\s*\[INICIO\]([\s\S]*?)\/\/\s*MOD-\1:\s*FIN/g;
    const modulos = [];
    let match;
    
    while ((match = modulosRegex.exec(codigoCompleto)) !== null) {
      modulos.push({
        numero: match[1],
        descripcion: match[2].trim(),
        codigo: match[0],
        inicio: match.index,
        fin: match.index + match[0].length
      });
    }
    
    if (modulos.length === 0) {
      return { success: false, error: 'No se detectaron módulos válidos' };
    }
    
    Logger.log('✅ Módulos parseados: ' + modulos.length);
    return { success: true, modulos: modulos };
    
  } catch (error) {
    Logger.log('❌ Error en parsearModulos: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-004: FIN

// MOD-005: EXTRAER HEADER [INICIO]
function extraerHeader(codigoCompleto) {
  try {
    const headerRegex = /\/\*{40}\s*PROYECTO:\s*(.+?)\s*ARCHIVO:\s*(.+?)\s*VERSIÓN:\s*(.+?)\s*FECHA:\s*(.+?)\s*\*{40}\//s;
    const match = codigoCompleto.match(headerRegex);
    
    if (!match) {
      return { success: false, error: 'Header no encontrado' };
    }
    
    const header = {
      proyecto: match[1].trim(),
      archivo: match[2].trim(),
      version: match[3].trim(),
      fecha: match[4].trim()
    };
    
    Logger.log('✅ Header extraído: ' + header.proyecto);
    return { success: true, header: header };
    
  } catch (error) {
    Logger.log('❌ Error en extraerHeader: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-005: FIN

// MOD-006: VALIDAR MÓDULO [INICIO]
function validarModulo(codigoModulo, numeroEsperado) {
  try {
    const inicioRegex = new RegExp(`\\/\\/\\s*MOD-${numeroEsperado}:\\s*.+?\\s*\\[INICIO\\]`);
    if (!inicioRegex.test(codigoModulo)) {
      return { success: false, error: `Falta [INICIO] en MOD-${numeroEsperado}` };
    }
    
    const finRegex = new RegExp(`\\/\\/\\s*MOD-${numeroEsperado}:\\s*FIN`);
    if (!finRegex.test(codigoModulo)) {
      return { success: false, error: `Falta FIN en MOD-${numeroEsperado}` };
    }
    
    return { success: true };
    
  } catch (error) {
    Logger.log('❌ Error en validarModulo: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-006: FIN

// MOD-007: REEMPLAZAR MÓDULO [INICIO]
function reemplazarModulo(codigoCompleto, numeroModulo, nuevoCodigoModulo) {
  try {
    if (!codigoCompleto || !numeroModulo || !nuevoCodigoModulo) {
      return { success: false, error: 'Parámetros incompletos' };
    }
    
    const validacion = validarModulo(nuevoCodigoModulo, numeroModulo);
    if (!validacion.success) {
      return validacion;
    }
    
    const moduloRegex = new RegExp(
      `\\/\\/\\s*MOD-${numeroModulo}:\\s*.+?\\s*\\[INICIO\\][\\s\\S]*?\\/\\/\\s*MOD-${numeroModulo}:\\s*FIN`,
      'g'
    );
    
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
// MOD-007: FIN

// MOD-008: ACTUALIZAR VERSIÓN [INICIO]
function actualizarVersion(codigo, headerActual) {
  try {
    const versionParts = headerActual.version.split('.');
    if (versionParts.length === 2) {
      versionParts[1] = String(parseInt(versionParts[1]) + 1).padStart(2, '0');
      const nuevaVersion = versionParts.join('.');
      
      const ahora = new Date();
      const opciones = { 
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false
      };
      
      const partes = ahora.toLocaleString('es-PE', opciones).split(/[\s,\/]+/);
      const nuevaFecha = `${partes[0]}/${partes[1]}/${partes[2]} (UTC-5)`;
      
      const headerRegex = /\/\*{40}[\s\S]*?\*{40}\//;
      const nuevoHeader = `/******************************************
PROYECTO: ${headerActual.proyecto}
ARCHIVO: ${headerActual.archivo}
VERSIÓN: ${nuevaVersion}
FECHA: ${nuevaFecha}
******************************************/`;
      
      const codigoActualizado = codigo.replace(headerRegex, nuevoHeader);
      
      Logger.log('✅ Versión actualizada: ' + headerActual.version + ' → ' + nuevaVersion);
      return codigoActualizado;
    }
    
    return codigo;
    
  } catch (error) {
    Logger.log('⚠️ No se pudo actualizar versión: ' + error.message);
    return codigo;
  }
}
// MOD-008: FIN

// MOD-009: OBTENER URL DE TESTS [INICIO]
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
// MOD-009: FIN

// MOD-010: OBTENER ESTÁNDAR DESDE GOOGLE DOC [INICIO]
function obtenerEstandar() {
  try {
    const docId = '1vbbaAPpTN9nQed_OOtoQBIp9K3PfNn5wgXWhNELAhqA';
    
    // Verificar acceso al documento
    let doc;
    try {
      doc = DocumentApp.openById(docId);
    } catch (accessError) {
      Logger.log('❌ Error de acceso al documento: ' + accessError.message);
      return { 
        success: false, 
        error: 'No puedo acceder al documento. Verifica que esté compartido como "Cualquiera con el enlace - Lector"' 
      };
    }
    
    // Obtener contenido
    const body = doc.getBody();
    if (!body) {
      Logger.log('❌ El documento no tiene cuerpo');
      return { success: false, error: 'El documento no tiene contenido' };
    }
    
    const texto = body.getText();
    
    if (!texto || texto.trim() === '') {
      Logger.log('⚠️ El documento está vacío');
      return { success: false, error: 'El documento está vacío' };
    }
    
    Logger.log('✅ Estándar obtenido desde Google Doc (' + texto.length + ' caracteres)');
    Logger.log('📄 Documento: ' + doc.getName());
    
    return { success: true, texto: texto };
    
  } catch (error) {
    Logger.log('❌ Error inesperado en obtenerEstandar: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    return { 
      success: false, 
      error: 'Error al leer el documento: ' + error.message 
    };
  }
}
// MOD-010: FIN

// MOD-011: NOTAS [INICIO]
/*
DESCRIPCIÓN:
Backend principal de CodeWorkShop para parseo, validación y reemplazo
de módulos en código modular. Ahora integrado con Google Docs para el estándar.

DEPENDENCIAS:
- MOD-002: Requiere archivos HTML (index, style, scripts, testweb)
- MOD-004: Usa regex para detectar formato MOD-XXX
- MOD-007: Llama a MOD-004, MOD-005, MOD-006 y MOD-008
- MOD-010: Requiere acceso a Google Docs API

ADVERTENCIAS:
- MOD-001: Debe ejecutarse manualmente antes del primer deploy
- MOD-005: El formato de header es simple (sin marco decorativo)
- MOD-008: Solo funciona con versiones formato XX.YY (dos secciones)
- MOD-010: Requiere que el documento esté compartido correctamente

CAMBIOS RECIENTES:
- v01.06: Integración con Google Doc para el estándar
- v01.06: Eliminado standard.html
- v01.06: Agregado MOD-010 para leer Google Doc
- v01.02: Nuevo formato de header simplificado

PRÓXIMAS MEJORAS:
- Implementar validación de tabulación en módulos
- Agregar detección automática de módulo de NOTAS
- Cache del estándar para reducir llamadas a Google Docs
*/
// MOD-011: FIN
