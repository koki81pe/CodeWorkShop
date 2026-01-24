// MOD-001: ENCABEZADO [INICIO]
/*
*****************************************
PROYECTO: CodeWorkShop
ARCHIVO: code.gs
VERSIÓN: 01.29
FECHA: 24/01/2026 01:24 (UTC-5)
*****************************************
*/
// MOD-001: FIN

// MOD-002: FORZAR PERMISOS [INICIO]
/**
 * Esta función DEBE ejecutarse manualmente una vez desde el editor
 * antes de desplegar la webapp para activar el flujo de autorización
 */
function forzarPermisos() {
  const SHEET_ID = '1FsuWVwImc0B-c2H5bxeI8TjEFp-dH-LIFGxyX-t7lZk';
  
  try {
    DriveApp.getRootFolder().getName();
    Logger.log('✅ Permiso Drive autorizado');
  } catch (e) {
    Logger.log('❌ Esperando autorización de Drive: ' + e);
    throw new Error('Autoriza Drive y vuelve a ejecutar');
  }
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName('Fecha');
    
    if (!hoja) {
      throw new Error('No se encontró la hoja "Fecha"');
    }
    
    const ahora = new Date();
    const fecha = Utilities.formatDate(ahora, 'America/Lima', 'dd/MM/yyyy HH:mm');
    
    hoja.appendRow([fecha]);
    
    Logger.log('✅ Permiso Spreadsheet autorizado');
    Logger.log('✅ Fecha registrada: ' + fecha);
  } catch (e) {
    Logger.log('❌ Error con Spreadsheet: ' + e);
    throw new Error('Autoriza Spreadsheet y vuelve a ejecutar');
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
 * sin importar el tipo de comentario.
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

  const patronMOD = /(<!--|\/\/|\/\*)\s*MOD-\d{3}[A-Z]?(-S\d{2}[A-Z]?)?/i;
  return patronMOD.test(codigo);
}
// MOD-005: FIN

// MOD-006: PARSEAR MÓDULOS V7 [INICIO]
/**
 * Parsea módulos de forma completamente agnóstica al lenguaje.
 * Detecta cualquier símbolo de comentario dinámicamente.
 * 
 * FILOSOFÍA:
 * - Herramienta quirúrgica, NO auditor
 * - Detecta módulos válidos, ignora el resto
 * - Si el usuario pega basura, es su problema
 * 
 * NOVEDADES V7:
 * - Incluye conteo de líneas por módulo (incluyendo delimitadores)
 * 
 * RETORNA:
 * {
 *   success: boolean,
 *   modulos: Array,
 *   estadisticas: { total, padres, hijos },
 *   error?: string
 * }
 */
function parsearModulos(codigoCompleto) {
  try {
    if (!codigoCompleto || typeof codigoCompleto !== 'string') {
      return { success: false, error: 'Código inválido o vacío' };
    }

    const modulos = [];
    const lineas = codigoCompleto.split('\n');

    // 🔹 PASO 1: Detectar todos los módulos
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      
      // Detectar apertura de módulo
      const apertura = detectarApertura(linea);
      
      if (!apertura) continue;
      
      // Construir patrón de cierre esperado
      const cierreEsperado = construirCierre(apertura);
      
      // Buscar el cierre
      let finEncontrado = false;
      let codigoBloque = linea + '\n';
      
      for (let j = i + 1; j < lineas.length; j++) {
        const lineaCierre = lineas[j];
        codigoBloque += lineaCierre + '\n';
        
        // Comparar ignorando espacios iniciales
        if (lineaCierre.trim() === cierreEsperado.trim()) {
          finEncontrado = true;
          break;
        }
      }
      
      if (!finEncontrado) continue;
      
      modulos.push({
        id: apertura.id,
        prefijo: apertura.prefijo,
        sufijo: apertura.sufijo,
        descripcion: apertura.descripcion,
        codigo: codigoBloque.trim(),
        lineas: codigoBloque.split('\n').length  // 🆕 CONTEO DE LÍNEAS
      });
    }

    if (modulos.length === 0) {
      return { success: false, error: 'No se detectaron MODs' };
    }

    // 🔹 PASO 2: Eliminar duplicados
    const unicos = eliminarDuplicados(modulos);

    // 🔹 PASO 3: Ordenar naturalmente
    unicos.sort((a, b) => {
      const idA = a.id.replace(/-/g, '~');
      const idB = b.id.replace(/-/g, '~');
      return idA.localeCompare(idB, undefined, { numeric: true });
    });

    // 🔹 PASO 4: Calcular estadísticas
    const estadisticas = calcularEstadisticas(unicos);

    Logger.log(`✅ MOD-006 v7.0: ${estadisticas.total} módulos (${estadisticas.padres} MOD + ${estadisticas.hijos} SubMOD)`);

    return {
      success: true,
      modulos: unicos,
      estadisticas: estadisticas
    };

  } catch (error) {
    Logger.log('❌ Error en MOD-006 v7.0: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Detecta si una línea contiene un delimitador de apertura válido.
 * 
 * REGLAS:
 * - Debe contener "MOD-" en mayúsculas
 * - Debe contener ":" después del ID
 * - Debe contener "[INICIO]" en mayúsculas
 * - Debe haber 1 espacio entre prefijo y "MOD-"
 * - Debe haber 1 espacio entre "[INICIO]" y sufijo (si hay sufijo)
 * - Ignora espacios/tabs al inicio de la línea
 */
function detectarApertura(linea) {
  // Ignorar espacios iniciales para la detección
  const lineaTrimIzq = linea.trimStart();
  
  // Buscar palabras clave en MAYÚSCULAS
  const posMOD = lineaTrimIzq.indexOf('MOD-');
  if (posMOD === -1) return null;
  
  const posINICIO = lineaTrimIzq.indexOf('[INICIO]', posMOD);
  if (posINICIO === -1) return null;
  
  const posDospuntos = lineaTrimIzq.indexOf(':', posMOD);
  if (posDospuntos === -1 || posDospuntos > posINICIO) return null;
  
  // 🔹 Validar que "MOD" esté en mayúsculas
  if (lineaTrimIzq.substring(posMOD, posMOD + 4) !== 'MOD-') return null;
  
  // 🔹 Validar que "[INICIO]" esté en mayúsculas
  if (lineaTrimIzq.substring(posINICIO, posINICIO + 8) !== '[INICIO]') return null;
  
  // 🔹 Extraer componentes
  const prefijo = lineaTrimIzq.substring(0, posMOD);
  const idCompleto = lineaTrimIzq.substring(posMOD, posDospuntos + 1);
  const textoDescripcion = lineaTrimIzq.substring(posDospuntos + 1, posINICIO);
  const sufijo = lineaTrimIzq.substring(posINICIO + 8); // 8 = length de "[INICIO]"
  
  // 🔹 Validar espaciado correcto
  // Debe haber 1 espacio entre prefijo y MOD (si hay prefijo)
  if (prefijo !== '' && !prefijo.endsWith(' ')) return null;
  
  // Debe haber 1 espacio entre [INICIO] y sufijo (si hay sufijo)
  if (sufijo !== '' && !sufijo.startsWith(' ')) return null;
  
  // 🔹 Limpiar la descripción (puede tener espacios antes de [INICIO])
  const descripcion = textoDescripcion.trim();
  
  return {
    prefijo: prefijo,
    id: idCompleto,
    descripcion: descripcion,
    sufijo: sufijo
  };
}

/**
 * Construye el patrón de cierre esperado dado un delimitador de apertura.
 * 
 * FORMATO:
 * prefijo + id + " FIN" + sufijo
 */
function construirCierre(apertura) {
  return apertura.prefijo + apertura.id + ' FIN' + apertura.sufijo;
}

/**
 * Elimina módulos duplicados usando Set.
 * Criterio: mismo ID + misma longitud de código
 */
function eliminarDuplicados(modulos) {
  const unicos = [];
  const vistos = new Set();
  
  modulos.forEach(m => {
    const key = m.id + '|' + m.codigo.length;
    if (!vistos.has(key)) {
      vistos.add(key);
      unicos.push(m);
    }
  });
  
  return unicos;
}

/**
 * Calcula estadísticas de módulos detectados.
 * 
 * RETORNA:
 * {
 *   total: número total de módulos,
 *   padres: módulos principales (sin -S),
 *   hijos: submódulos (con -S)
 * }
 */
function calcularEstadisticas(modulos) {
  const padres = modulos.filter(m => !m.id.includes('-S'));
  const hijos = modulos.filter(m => m.id.includes('-S'));
  
  return {
    total: modulos.length,
    padres: padres.length,
    hijos: hijos.length
  };
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

// MOD-008: VALIDAR MÓDULO V3 [INICIO]
/**
 * Valida que un módulo conserve correctamente sus delimitadores.
 * Versión ultra agnóstica: no asume tipo de comentario.
 *
 * VALIDACIONES:
 * - Delimitador de INICIO presente y correcto
 * - Delimitador de FIN presente y correcto
 * - Los símbolos (prefijo y sufijo) coinciden entre INICIO y FIN
 * - El ID coincide exactamente
 * - INICIO aparece antes que FIN
 *
 * @param {string} codigoModulo - Bloque completo del módulo
 * @param {string} idEsperado   - ID con ':' (ej: "MOD-008:", "MOD-004-S01:")
 * @param {string} prefijoEsperado - Símbolos antes de MOD (ej: "// ", "<!-- ")
 * @param {string} sufijoEsperado - Símbolos después de [INICIO]/FIN (ej: "", " -->")
 * @return {Object} {success: boolean, error?: string}
 */
function validarModulo(codigoModulo, idEsperado, prefijoEsperado, sufijoEsperado) {
  try {
    if (!codigoModulo || typeof codigoModulo !== 'string' || !idEsperado) {
      return {
        success: false,
        error: 'Parámetros inválidos en validarModulo'
      };
    }

    const id = idEsperado.trim();
    const prefijo = prefijoEsperado || '';
    const sufijo = sufijoEsperado || '';

    // 🔹 Buscar los delimitadores en el código
    const lineas = codigoModulo.split('\n');
    
    let encontradoInicio = false;
    let encontradoFin = false;
    let posLineaInicio = -1;
    let posLineaFin = -1;

    for (let i = 0; i < lineas.length; i++) {
      const lineaTrim = lineas[i].trim();
      
      // 🆕 VALIDAR INICIO: prefijo + id + cualquier cosa + [INICIO] + sufijo
      if (lineaTrim.startsWith(prefijo.trim()) && 
          lineaTrim.includes(id) && 
          lineaTrim.includes('[INICIO]') &&
          lineaTrim.endsWith(sufijo.trim())) {
        encontradoInicio = true;
        posLineaInicio = i;
      }
      
      // 🆕 VALIDAR FIN: prefijo + id + FIN + sufijo
      const patronFinEsperado = (prefijo + id + ' FIN' + sufijo).trim();
      if (lineaTrim === patronFinEsperado) {
        encontradoFin = true;
        posLineaFin = i;
      }
    }

    // 🔹 VALIDAR que existan ambos delimitadores
    if (!encontradoInicio) {
      return {
        success: false,
        error: `Falta delimitador de INICIO correcto en ${id}`
      };
    }

    if (!encontradoFin) {
      return {
        success: false,
        error: `Falta delimitador de FIN correcto en ${id}`
      };
    }

    // 🔹 VALIDAR orden: INICIO antes que FIN
    if (posLineaInicio >= posLineaFin) {
      return {
        success: false,
        error: `Orden incorrecto: FIN antes de INICIO en ${id}`
      };
    }

    return { success: true };

  } catch (error) {
    Logger.log('❌ Error en validarModulo (MOD-008 v4.0): ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-008: FIN

// MOD-009: REEMPLAZAR MÓDULO V6 [INICIO]
/**
 * Reemplaza un módulo en el código original de forma completamente agnóstica.
 * Detecta dinámicamente el prefijo y sufijo del módulo original.
 * 
 * PROCESO:
 * 1. Buscar el módulo en el código original
 * 2. Extraer su prefijo y sufijo
 * 3. Validar que el nuevo módulo use los mismos símbolos
 * 4. Reemplazar el bloque exacto
 * 
 * @param {string} codigoCompleto - Código original completo
 * @param {string} idModulo - ID del módulo a reemplazar (ej: "MOD-009:")
 * @param {string} nuevoModulo - Nuevo código del módulo completo
 * @return {Object} {success: boolean, codigo?: string, error?: string}
 */
function reemplazarModulo(codigoCompleto, idModulo, nuevoModulo) {
  try {
    if (!codigoCompleto || !idModulo || !nuevoModulo) {
      return {
        success: false,
        error: 'Parámetros incompletos en reemplazarModulo'
      };
    }

    // 🔹 PASO 1: Buscar el módulo original en el código
    const moduloOriginal = buscarModuloOriginal(codigoCompleto, idModulo);
    
    if (!moduloOriginal.success) {
      return {
        success: false,
        error: `${idModulo} no encontrado en el código original`
      };
    }

    // 🔹 PASO 2: Extraer prefijo y sufijo del módulo original
    const prefijo = moduloOriginal.prefijo;
    const sufijo = moduloOriginal.sufijo;

    // 🔹 PASO 3: Validar que el nuevo módulo use los mismos símbolos
    const validacion = validarModulo(nuevoModulo, idModulo, prefijo, sufijo);
    
    if (!validacion.success) {
      return validacion;
    }

    // 🔹 PASO 4: Encontrar posición exacta del módulo original
    const posiciones = encontrarPosicionModulo(codigoCompleto, idModulo, prefijo, sufijo);
    
    if (!posiciones.success) {
      return {
        success: false,
        error: `No se pudo localizar ${idModulo} en el código`
      };
    }

    // 🔹 PASO 5: Reemplazar el bloque exacto
    const antes = codigoCompleto.substring(0, posiciones.inicio);
    const despues = codigoCompleto.substring(posiciones.fin);
    const codigoActualizado = antes + nuevoModulo.trim() + despues;

    Logger.log(`✅ MOD-009 v6.0: ${idModulo} reemplazado exitosamente`);

    return {
      success: true,
      codigo: codigoActualizado
    };

  } catch (error) {
    Logger.log('❌ Error en MOD-009 v6.0: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Busca un módulo en el código y extrae su información.
 * 
 * @param {string} codigo - Código completo donde buscar
 * @param {string} idModulo - ID del módulo (ej: "MOD-009:")
 * @return {Object} {success, prefijo?, sufijo?, error?}
 */
function buscarModuloOriginal(codigo, idModulo) {
  const lineas = codigo.split('\n');
  
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const lineaTrim = linea.trimStart();
    
    // Buscar línea que contenga el ID + [INICIO]
    const posID = lineaTrim.indexOf(idModulo);
    if (posID === -1) continue;
    
    const posINICIO = lineaTrim.indexOf('[INICIO]', posID);
    if (posINICIO === -1) continue;
    
    // Extraer prefijo y sufijo
    const prefijo = lineaTrim.substring(0, posID);
    const sufijo = lineaTrim.substring(posINICIO + 8); // 8 = length("[INICIO]")
    
    return {
      success: true,
      prefijo: prefijo,
      sufijo: sufijo
    };
  }
  
  return {
    success: false,
    error: 'Módulo no encontrado'
  };
}

/**
 * Encuentra la posición exacta (inicio y fin) de un módulo en el código.
 * Búsqueda flexible: tolera descripciones variables en el delimitador de INICIO.
 * 
 * @param {string} codigo - Código completo
 * @param {string} idModulo - ID del módulo
 * @param {string} prefijo - Prefijo del delimitador
 * @param {string} sufijo - Sufijo del delimitador
 * @return {Object} {success, inicio?, fin?, error?}
 */
function encontrarPosicionModulo(codigo, idModulo, prefijo, sufijo) {
  const lineas = codigo.split('\n');
  
  const patronFin = (prefijo + idModulo + ' FIN' + sufijo).trim();
  
  let posicionInicio = -1;
  let posicionFin = -1;
  let caracterInicio = 0;
  let caracterFin = 0;
  
  // 🆕 Buscar línea de inicio (FLEXIBLE con descripción)
  for (let i = 0; i < lineas.length; i++) {
    const lineaTrim = lineas[i].trim();
    
    // Verificar que la línea contenga todos los elementos clave
    if (lineaTrim.startsWith(prefijo.trim()) && 
        lineaTrim.includes(idModulo) && 
        lineaTrim.includes('[INICIO]') &&
        lineaTrim.endsWith(sufijo.trim())) {
      posicionInicio = i;
      break;
    }
    caracterInicio += lineas[i].length + 1; // +1 por el \n
  }
  
  if (posicionInicio === -1) {
    return {
      success: false,
      error: 'No se encontró la línea de INICIO'
    };
  }
  
  // Buscar línea de fin (EXACTA)
  caracterFin = caracterInicio;
  for (let i = posicionInicio; i < lineas.length; i++) {
    if (lineas[i].trim() === patronFin) {
      posicionFin = i;
      caracterFin += lineas[i].length; // Incluir la línea completa de FIN
      break;
    }
    caracterFin += lineas[i].length + 1; // +1 por el \n
  }
  
  if (posicionFin === -1) {
    return {
      success: false,
      error: 'No se encontró la línea de FIN'
    };
  }
  
  return {
    success: true,
    inicio: caracterInicio,
    fin: caracterFin
  };
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

// MOD-011: OBTENER ESTÁNDAR DESDE GOOGLE DOC [INICIO]
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
// MOD-011: FIN

// MOD-012: CÓDIGO DE CIERRE [INICIO]
// Sistema iniciado
Logger.log('✅ CodeWorkShop Backend v01.07 cargado');
Logger.log('📋 Soporta archivos .GS y .HTML (CodeWorkshop v2.2)');
// MOD-012: FIN

// MOD-013: ORDENAR Y NORMALIZAR MÓDULOS [INICIO]
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
// MOD-013: FIN

// MOD-014: REEMPLAZAR MÚLTIPLES MÓDULOS [INICIO]
/**
 * Reemplaza múltiples módulos en un solo paso.
 * Parsea el texto pegado, detecta módulos y los reemplaza secuencialmente.
 * 
 * @param {string} codigoCompleto - Código original completo
 * @param {string} textoMultiMod - Texto con múltiples módulos a reemplazar
 * @return {Object} {success, codigo?, error?, modulosReemplazados?}
 */
function reemplazarMultiplesModulos(codigoCompleto, textoMultiMod) {
  try {
    if (!codigoCompleto || !textoMultiMod) {
      return {
        success: false,
        error: 'Faltan parámetros: código original o módulos a reemplazar'
      };
    }

    // 1️⃣ Parsear módulos del textarea Multi MOD
    const resultadoParseo = parsearModulos(textoMultiMod);
    
    if (!resultadoParseo.success) {
      return {
        success: false,
        error: 'No se detectaron módulos válidos en el texto pegado'
      };
    }
    
    const modulosAPegar = resultadoParseo.modulos;
    
    if (modulosAPegar.length === 0) {
      return {
        success: false,
        error: 'No se encontraron módulos para reemplazar'
      };
    }

    let codigoActualizado = codigoCompleto;
    
    // 2️⃣ Reemplazar cada módulo secuencialmente
    for (let i = 0; i < modulosAPegar.length; i++) {
      const mod = modulosAPegar[i];
      
      const resultado = reemplazarModulo(
        codigoActualizado,
        mod.id,
        mod.codigo
      );
      
      if (!resultado.success) {
        return {
          success: false,
          error: `Error al reemplazar ${mod.id}: ${resultado.error}`
        };
      }
      
      codigoActualizado = resultado.codigo;
    }
    
    // 3️⃣ Retornar código final
    Logger.log(`✅ MOD-014: ${modulosAPegar.length} módulos reemplazados exitosamente`);
    
    return {
      success: true,
      codigo: codigoActualizado,
      modulosReemplazados: modulosAPegar.length
    };
    
  } catch (error) {
    Logger.log('❌ Error en MOD-014: ' + error.message);
    return {
      success: false,
      error: 'Error inesperado al procesar múltiples módulos'
    };
  }
}
// MOD-014: FIN

// MOD-099: NOTAS [INICIO]
/*
Backend central de CodeWorkShop.
Responsable de detectar, parsear y reemplazar módulos y submódulos.

CAPACIDADES CLAVE:
- 🆕 ULTRA AGNÓSTICO: Detecta módulos con cualquier símbolo de comentario
- Soporta MODs y SubMODs jerárquicos (IDs alfanuméricos)
- Detecta dinámicamente prefijo y sufijo de delimitadores
- Validación estricta: rechaza código con texto sin modular
- Estadísticas automáticas: cuenta MODs principales y SubMODs

FUNCIONES CRÍTICAS:
- parsearModulos() v4.0 - Detección ultra agnóstica
- validarModulo() v4.0 - Validación por prefijo/sufijo
- reemplazarModulo() v5.0 - Reemplazo ultra agnóstico

FUNCIONES AUXILIARES:
- detectarApertura() - Detecta delimitador de INICIO dinámicamente
- construirCierre() - Construye patrón de FIN esperado
- validarTextoModulado() - Rechaza código sin modular
- eliminarDuplicados() - Elimina MODs duplicados
- calcularEstadisticas() - Cuenta MODs y SubMODs
- buscarModuloOriginal() - Extrae prefijo/sufijo del código original
- encontrarPosicionModulo() - Localiza posición exacta para reemplazo

REGLAS DE DELIMITADORES:
- Formato apertura: [prefijo] + MOD-XXX: + [descripción] + [INICIO] + [sufijo]
- Formato cierre: [prefijo] + MOD-XXX: + FIN + [sufijo]
- Prefijo y sufijo deben coincidir 100% entre apertura y cierre
- Espacios iniciales de línea se ignoran en detección
- MOD, [INICIO] y FIN deben estar en MAYÚSCULAS

ADVERTENCIAS:
- El ID del módulo debe conservarse exactamente
- Los delimitadores MOD son la única fuente de verdad
- SubMODs mal escritos se ignoran (se tratan como contenido del padre)
- Código sin modular genera error y rechaza todo el bloque

ACTUALIZACIÓN V01.26 (Ultra Agnóstico):
- MOD-006 v4.0: Detección ultra agnóstica de módulos
- MOD-008 v4.0: Validación por prefijo/sufijo dinámico
- MOD-009 v5.0: Reemplazo ultra agnóstico
- MOD-014: Multi MOD compatible con ultra agnóstico

ESTADO:
✔ Ultra Agnóstico - Soporta cualquier lenguaje de programación
✔ Validación estricta de código sin modular
✔ Estadísticas automáticas (MOD + SubMOD)
✔ Alineado con Standard CodeWorkShop v5.0
*/
// MOD-099: FIN
