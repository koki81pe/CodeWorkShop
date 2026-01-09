/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ PROYECTO: CodeWorkShop                                   ║
 * ║ ARCHIVO: code.gs                                         ║
 * ║ VERSIÓN: 1.1.1                                           ║
 * ║ FECHA: 10/01/2026 03:00 (UTC-5)                          ║
 * ╚══════════════════════════════════════════════════════════╝
 */

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
    const headerRegex = /\/\*\*[\s\S]*?PROYECTO:\s*(.+?)[\s\S]*?ARCHIVO:\s*(.+?)[\s\S]*?VERSIÓN:\s*(.+?)[\s\S]*?FECHA:\s*(.+?)\*\//;
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
    if (versionParts.length === 3) {
      versionParts[2] = String(parseInt(versionParts[2]) + 1);
      const nuevaVersion = versionParts.join('.');
      
      const ahora = new Date();
      const opciones = { 
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      
      const fechaFormateada = ahora.toLocaleString('es-PE', opciones)
        .replace(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+)/, '$1/$2/$3 $4:$5');
      
      const nuevaFecha = fechaFormateada + ' (UTC-5)';
      
      const headerRegex = /\/\*\*[\s\S]*?VERSIÓN:\s*(.+?)[\s\S]*?FECHA:\s*(.+?)\*\//;
      const codigoActualizado = codigo.replace(headerRegex, function(match) {
        return match
          .replace(/VERSIÓN:\s*(.+?)[\s\S]/, `VERSIÓN: ${nuevaVersion}                                        ║\n`)
          .replace(/FECHA:\s*(.+?)\*\//, `FECHA: ${nuevaFecha}                         ║\n * ╚══════════════════════════════════════════════════════════╝\n */`);
      });
      
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
