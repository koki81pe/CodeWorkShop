// MOD-001: ENCABEZADO [INICIO]
/*
*****************************************
PROYECTO: CodeWorkShop
ARCHIVO: code.gs
VERSIÓN: 01.14
FECHA: 17/01/2026 08:01 (UTC-5)
*****************************************
*/
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

// MOD-005: DETECTAR MÓDULOS (AGNÓSTICO) [INICIO]
/**
 * Detecta si un código contiene delimitadores MOD válidos,
 * sin importar el tipo de comentario (// o <!-- -->).
 *
 * No decide tipo de archivo.
 * No impone formato.
 * Solo verifica presencia de MODs.
 *
 * @param {string} codigo - Código completo a analizar
 * @return {boolean} true si hay al menos un MOD-XXX
 */
function contieneModulos(codigo) {
  if (!codigo || typeof codigo !== 'string') return false;

  const patronMOD = /(<!--|\/\/)\s*MOD-\d{3}[A-Z]?(-S\d{2}[A-Z]?)?/i;
  return patronMOD.test(codigo);
}
// MOD-005: FIN

// MOD-006: PARSEAR MÓDULOS (AGNÓSTICO TOTAL v1.9) [INICIO]
function parsearModulos(codigoCompleto) {
  try {
    if (!codigoCompleto || typeof codigoCompleto !== 'string') {
      return { success: false, error: 'Código inválido o vacío' };
    }

    const modulos = [];

    // 1️⃣ Detectar TODOS los INICIO (MOD y SubMOD)
    const inicioRegex =
      /(<!--|\/\/)\s*MOD-([0-9]{3}[A-Z]?(?:-S[0-9]{2}[A-Z]?)?)\s*:\s*(.*?)\s*\[INICIO\]/gi;

    let match;

    while ((match = inicioRegex.exec(codigoCompleto)) !== null) {
      const tipoComentario = match[1]; // <!-- o //
      const id = match[2].trim();
      const descripcion = match[3]?.trim() || '';

      // 2️⃣ Buscar FIN correspondiente desde este punto
      const idSeguro = id.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      // 🔹 CORRECCIÓN: Capturar el cierre del comentario si existe
      let finRegex;
      if (tipoComentario === '<!--') {
        // Para HTML: capturar "MOD-XXX: FIN -->"
        finRegex = new RegExp(`MOD-${idSeguro}\\s*:\\s*FIN\\s*-->`, 'i');
      } else {
        // Para GS: capturar "// MOD-XXX: FIN"
        finRegex = new RegExp(`\\/\\/\\s*MOD-${idSeguro}\\s*:\\s*FIN`, 'i');
      }

      const resto = codigoCompleto.slice(match.index);
      const finMatch = finRegex.exec(resto);

      if (!finMatch) continue;

      const bloque = resto.slice(
        0,
        finMatch.index + finMatch[0].length
      );

      modulos.push({
        id,
        descripcion,
        codigo: bloque.trim()
      });
    }

    if (modulos.length === 0) {
      return { success: false, error: 'No se detectaron MODs' };
    }

    // 3️⃣ Eliminar duplicados (mismo ID + mismo contenido)
    const unicos = [];
    const vistos = new Set();

    modulos.forEach(m => {
      const key = m.id + '|' + m.codigo.length;
      if (!vistos.has(key)) {
        vistos.add(key);
        unicos.push(m);
      }
    });

    // 4️⃣ Orden natural por ID
    unicos.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );

    Logger.log(`✅ MOD-006 v1.9: ${unicos.length} módulos detectados`);

    return {
      success: true,
      modulos: unicos,
      tipo: 'plano'
    };

  } catch (error) {
    Logger.log('❌ Error en MOD-006 v1.9: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-006: FIN

// MOD-007: EXTRAER HEADER (AGNÓSTICO) [INICIO]
/**
 * Extrae el header CodeWorkShop sin asumir tipo de archivo.
 * Soporta:
 * - /* ... *\/
 * - <!-- ... -->
 *
 * Campos obligatorios:
 * PROYECTO, ARCHIVO, VERSIÓN, FECHA
 *
 * El header DEBE estar al inicio del archivo.
 */
function extraerHeader(codigoCompleto) {
  try {
    if (!codigoCompleto || typeof codigoCompleto !== 'string') {
      return { success: false, error: 'Código inválido' };
    }

    // Header solo si está al inicio (ignora espacios y saltos)
    const headerRegex = new RegExp(
      `^\\s*(\\/\\*[\\s\\S]*?\\*\\/|<!--[\\s\\S]*?-->)`
    );

    const match = codigoCompleto.match(headerRegex);
    if (!match) {
      return { success: false, error: 'Header no encontrado al inicio' };
    }

    const bloque = match[1];

    const campo = (nombre) => {
      const r = new RegExp(`${nombre}:\\s*(.+)`, 'i');
      const m = bloque.match(r);
      return m ? m[1].trim() : null;
    };

    const header = {
      proyecto: campo('PROYECTO'),
      archivo:  campo('ARCHIVO'),
      version:  campo('VERSIÓN'),
      fecha:    campo('FECHA'),
      raw:      bloque,
      inicio:   match.index,
      fin:      match.index + bloque.length
    };

    if (!header.proyecto || !header.archivo || !header.version || !header.fecha) {
      return { success: false, error: 'Header incompleto o no estándar' };
    }

    return { success: true, header };

  } catch (error) {
    Logger.log('❌ Error en extraerHeader (MOD-007): ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-007: FIN

// MOD-008: VALIDAR MÓDULO [INICIO]
/**
 * Valida que un módulo conserve correctamente
 * sus delimitadores MOD-[ID] [INICIO] y MOD-[ID] FIN
 *
 * ✔ Agnóstico al tipo de comentario
 *
 * ✔ NO analiza el contenido interno
 * ✔ NO usa regex peligrosas
 * ✔ NO se rompe con strings, regex ni backslashes
 *
 * @param {string} codigoModulo - Bloque completo del módulo
 * @param {string} idEsperado   - ID (ej: "008", "004-S01A")
 */
function validarModulo(codigoModulo, idEsperado) {
  try {
    if (
      !codigoModulo ||
      typeof codigoModulo !== 'string' ||
      !idEsperado
    ) {
      return {
        success: false,
        error: 'Parámetros inválidos en validarModulo'
      };
    }

    const id = idEsperado.trim();

    // Normalizamos a texto plano para búsquedas simples
    const texto = codigoModulo;

    // 🔹 Patrones simples (NO regex complejas)
    const inicioOK =
      texto.includes(`MOD-${id}`) &&
      texto.includes('[INICIO]');

    const finOK =
      texto.includes(`MOD-${id}`) &&
      texto.includes('FIN');

    if (!inicioOK) {
      return {
        success: false,
        error: `Falta etiqueta [INICIO] en MOD-${id}`
      };
    }

    if (!finOK) {
      return {
        success: false,
        error: `Falta etiqueta FIN en MOD-${id}`
      };
    }

    // 🔹 Orden lógico: INICIO antes que FIN
    const posInicio = texto.indexOf('[INICIO]');
    const posFin = texto.lastIndexOf('FIN');

    if (posInicio > posFin) {
      return {
        success: false,
        error: `Orden incorrecto: FIN antes de INICIO en MOD-${id}`
      };
    }

    return { success: true };

  } catch (error) {
    Logger.log('❌ Error en validarModulo (MOD-008): ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-008: FIN

// MOD-009: REEMPLAZAR MÓDULO (BLOQUE EXACTO v2.7) [INICIO]
function reemplazarModulo(codigoCompleto, idModulo, nuevoModulo) {
  try {
    if (!codigoCompleto || !idModulo || !nuevoModulo) {
      return {
        success: false,
        error: 'Parámetros incompletos en reemplazarModulo'
      };
    }

    const validacion = validarModulo(nuevoModulo, idModulo);
    if (!validacion.success) return validacion;

    // Escapar ID para regex segura
    const idSeguro = idModulo.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // 🔹 CORRECCIÓN: Detectar tipo de comentario del módulo original
    const muestraHTML = /<!--\s*MOD-/i.test(codigoCompleto);
    const muestraGS = /\/\/\s*MOD-/i.test(codigoCompleto);

    let regex;

    if (muestraHTML) {
      // 🔹 Para HTML: capturar TODO incluyendo el --> final
      regex = new RegExp(
        `<!--\\s*MOD-${idSeguro}\\s*:[^\\n]*\\[INICIO\\][\\s\\S]*?` +
        `MOD-${idSeguro}\\s*:\\s*FIN\\s*-->`,
        'gm'
      );
    } else {
      // 🔹 Para GS: capturar sin --> (no lo tiene)
      regex = new RegExp(
        `\\/\\/\\s*MOD-${idSeguro}\\s*:[^\\n]*\\[INICIO\\][\\s\\S]*?` +
        `\\/\\/\\s*MOD-${idSeguro}\\s*:\\s*FIN`,
        'gm'
      );
    }

    if (!regex.test(codigoCompleto)) {
      return {
        success: false,
        error: `MOD-${idModulo} no encontrado para reemplazo`
      };
    }

    // 🔹 CORRECCIÓN: Reemplazar el bloque COMPLETO (con su --> si lo tiene)
    const codigoActualizado = codigoCompleto.replace(
      regex,
      nuevoModulo.trim()
    );

    return {
      success: true,
      codigo: codigoActualizado
    };

  } catch (error) {
    Logger.log('❌ Error en MOD-009 v2.7: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-009: FIN

// MOD-010: ACTUALIZAR VERSIÓN [INICIO]
/**
 * Actualiza automáticamente la versión y fecha en el header CodeWorkShop.
 * Compatible con headers:
 * - /* ... *\/
 * - <!-- ... -->
 *
 * Requiere header obtenido desde MOD-007 (agnóstico).
 */
function actualizarVersion(codigoCompleto, headerActual) {
  try {
    if (
      !codigoCompleto ||
      !headerActual ||
      !headerActual.version ||
      headerActual.inicio == null ||
      headerActual.fin == null
    ) {
      return codigoCompleto;
    }

    // 🔹 Incrementar versión menor (01.13 → 01.14)
    const partes = headerActual.version.split('.');
    if (partes.length !== 2) return codigoCompleto;

    partes[1] = String(parseInt(partes[1], 10) + 1).padStart(2, '0');
    const nuevaVersion = partes.join('.');

    // 🔹 Nueva fecha
    const now = new Date();
    const TZ = 'America/Lima';
    const fecha = Utilities.formatDate(now, TZ, 'dd/MM/yyyy HH:mm');
    const nuevaFecha = `${fecha} (UTC-5)`;

    // 🔹 Detectar tipo de comentario desde el header original
    const esHTML = headerActual.raw.trim().startsWith('<!--');

    const nuevoHeader = esHTML
      ? `<!--
*****************************************
PROYECTO: ${headerActual.proyecto}
ARCHIVO: ${headerActual.archivo}
VERSIÓN: ${nuevaVersion}
FECHA: ${nuevaFecha}
*****************************************
-->`
      : `/*
*****************************************
PROYECTO: ${headerActual.proyecto}
ARCHIVO: ${headerActual.archivo}
VERSIÓN: ${nuevaVersion}
FECHA: ${nuevaFecha}
*****************************************
*/`;

    // 🔹 Reemplazo quirúrgico del header
    return (
      codigoCompleto.slice(0, headerActual.inicio) +
      nuevoHeader +
      codigoCompleto.slice(headerActual.fin)
    );

  } catch (error) {
    Logger.log('⚠️ Error en actualizarVersion (MOD-010): ' + error.message);
    return codigoCompleto;
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

// MOD-014: ORDENAR Y NORMALIZAR MÓDULOS [INICIO]
/**
 * Ordena módulos y submódulos según estándar CodeWorkShop v2.3
 * Usa metadata generada por MOD-006:
 * - _ordenBase
 * - _ordenLetra
 * - _ordenSub
 * - _ordenSubLetra
 *
 * Orden resultante:
 * MOD-004
 * MOD-004A
 * MOD-004-S01
 * MOD-004-S01A
 * MOD-005
 *
 * @param {Array} modulos - Array de módulos parseados por MOD-006
 * @return {Array} Array ordenado de módulos
 */
function ordenarModulos(modulos) {
  try {
    if (!Array.isArray(modulos)) {
      return [];
    }
    return modulos.sort((a, b) => {
      // 1️⃣ Orden por número base
      if (a._ordenBase !== b._ordenBase) {
        return a._ordenBase - b._ordenBase;
      }
      // 2️⃣ Orden por letra base ('' < 'A' < 'B')
      if (a._ordenLetra !== b._ordenLetra) {
        return a._ordenLetra.localeCompare(b._ordenLetra);
      }
      // 3️⃣ Padre antes que submódulos
      if (a.esSubmod !== b.esSubmod) {
        return a.esSubmod ? 1 : -1;
      }
      // 4️⃣ Orden por número de submódulo
      if (a._ordenSub !== b._ordenSub) {
        return a._ordenSub - b._ordenSub;
      }
      // 5️⃣ Orden por letra de submódulo
      return a._ordenSubLetra.localeCompare(b._ordenSubLetra);
    });
  } catch (error) {
    Logger.log('❌ Error en ordenarModulos (MOD-015): ' + error.message);
    return modulos;
  }
}
// MOD-014: FIN

// MOD-015: NOTAS [INICIO]
/*
Backend central de CodeWorkShop.
Responsable de detectar, parsear y reemplazar módulos y submódulos.

CAPACIDADES CLAVE:
- Soporta MODs y SubMODs jerárquicos (IDs alfanuméricos).
- Detecta módulos usando patrones MOD-XXX y MOD-XXX-SYY.
- Independiente del tipo de comentario (// o <!-- -->).

FUNCIONES CRÍTICAS:
- parsearModulos()
- reemplazarModulo()
- validarModulo()

ADVERTENCIAS:
- El ID del módulo debe conservarse exactamente.
- Los delimitadores MOD son la única fuente de verdad.

ESTADO:
✔ Estable
✔ Alineado con CodeWorkShop v2.3
*/
// MOD-015: FIN
