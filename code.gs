// MOD-001: ENCABEZADO [INICIO]
/*
*****************************************
PROYECTO: CodeWorkShop
ARCHIVO: code.gs
VERSIÓN: 01.68
FECHA: 10/02/2026 15:39 (UTC-5)
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

// MOD-013: ORDENAR Y NORMALIZAR MÓDULOS V2 [INICIO]
/**
 * Ordena módulos y submódulos según estándar CodeWorkShop v2.3
 * 
 * VERSION 2: Manejo robusto de módulos sin metadata
 * - Extrae números y letras dinámicamente si faltan propiedades
 * - No crashea con módulos mal formados
 * 
 * Orden resultante:
 * MOD-004
 * MOD-004A
 * MOD-004-S01
 * MOD-004-S01A
 * MOD-005
 *
 * @param {Array} modulos - Array de módulos parseados
 * @return {Array} Array ordenado de módulos
 */
function ordenarModulos(modulos) {
  try {
    if (!Array.isArray(modulos)) {
      return [];
    }
    
    return modulos.sort((a, b) => {
      // Extraer información del ID si no existe metadata
      const infoA = extraerInfoOrdenamiento(a);
      const infoB = extraerInfoOrdenamiento(b);
      
      // 1️⃣ Orden por número base
      if (infoA.numeroBase !== infoB.numeroBase) {
        return infoA.numeroBase - infoB.numeroBase;
      }
      
      // 2️⃣ Orden por letra base ('' < 'A' < 'B')
      if (infoA.letraBase !== infoB.letraBase) {
        return infoA.letraBase.localeCompare(infoB.letraBase);
      }
      
      // 3️⃣ Padre antes que submódulos
      if (infoA.esSubmod !== infoB.esSubmod) {
        return infoA.esSubmod ? 1 : -1;
      }
      
      // 4️⃣ Orden por número de submódulo
      if (infoA.numeroSub !== infoB.numeroSub) {
        return infoA.numeroSub - infoB.numeroSub;
      }
      
      // 5️⃣ Orden por letra de submódulo
      return infoA.letraSub.localeCompare(infoB.letraSub);
    });
    
  } catch (error) {
    Logger.log('❌ Error en ordenarModulos (MOD-013 v2): ' + error.message);
    return modulos;
  }
}

/**
 * Extrae información de ordenamiento de un módulo.
 * Usa metadata si existe, sino parsea el ID directamente.
 */
function extraerInfoOrdenamiento(modulo) {
  const id = modulo.id || '';
  
  // Detectar si es submódulo
  const esSubmod = id.includes('-S');
  
  // Extraer número base (MOD-004A: → 4, MOD-004-S01: → 4)
  const matchBase = id.match(/MOD-(\d+)([A-Z]*)/i);
  const numeroBase = matchBase ? parseInt(matchBase[1]) : 0;
  const letraBase = matchBase && matchBase[2] ? matchBase[2].toUpperCase() : '';
  
  // Extraer número y letra de submódulo si existe
  let numeroSub = 0;
  let letraSub = '';
  
  if (esSubmod) {
    const matchSub = id.match(/-S(\d+)([A-Z]*)/i);
    numeroSub = matchSub ? parseInt(matchSub[1]) : 0;
    letraSub = matchSub && matchSub[2] ? matchSub[2].toUpperCase() : '';
  }
  
  return {
    numeroBase,
    letraBase,
    esSubmod,
    numeroSub,
    letraSub
  };
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

// MOD-015: AGREGAR MODULO HÍBRIDO V5 [INICIO]

// MOD-015-001: FUNCIÓN PRINCIPAL HÍBRIDA V5 [INICIO]
/**
 * Función híbrida inteligente: REEMPLAZA si existe, AGREGA si es nuevo.
 * 
 * PROCESO V5 (LÓGICA SIMPLE):
 * 1. Parsear módulos originales y nuevos
 * 2. Clasificar en reemplazos y agregados
 * 3. Procesar todos los REEMPLAZOS primero
 * 4. ORDENAR agregados por número (para insertar en secuencia correcta)
 * 5. Procesar AGREGADOS uno por uno:
 *    - Buscar antecesor → insertar después de su FIN
 *    - Si no hay antecesor, buscar sucesor → insertar antes de su INICIO
 * 
 * @param {string} codigoCompleto - Código original completo
 * @param {string} nuevoTexto - Código con 1+ módulos a procesar  
 * @return {Object} {success, codigo?, accionRealizada, modulosProcesados?, error?}
 */
// MOD-015: AGREGAR MÓDULO NUEVO HÍBRIDO V6.0 [INICIO]
/**
 * Agrega o reemplaza módulos de forma híbrida.
 * VERSIÓN 6.0: Acepta parámetro reenumerar
 *
 * LÓGICA:
 * 1. Si el ID ya existe → REEMPLAZO
 * 2. Si el ID NO existe → AGREGADO
 * 3. Si reenumerar=true → Ejecuta reenumeración completa al final
 *
 * @param {string} codigoCompleto - Código original
 * @param {string} nuevoTexto - Módulo(s) a agregar/reemplazar
 * @param {boolean} reenumerar - Si debe reenumerar después (opcional, default: false)
 * @return {Object} {success, codigo, accionRealizada, modulosProcesados, reenumerado}
 */
function agregarModuloNuevo(codigoCompleto, nuevoTexto, reenumerar) {
  try {
    if (!codigoCompleto || !nuevoTexto) {
      return { success: false, error: 'Parámetros incompletos' };
    }
    
    // 🔹 Valor por defecto para reenumerar
    const debeReenumerar = reenumerar === true;

    // 🔹 ETAPA 1: Parsear módulos existentes y nuevos
    const modulosExistentes = parsearModulos(codigoCompleto);
    if (!modulosExistentes.success) {
      return { success: false, error: 'No se pudieron parsear módulos existentes' };
    }

    const modulosNuevos = parsearModulos(nuevoTexto);
    if (!modulosNuevos.success || modulosNuevos.modulos.length === 0) {
      return { success: false, error: 'No se detectaron módulos válidos en nuevo código' };
    }

    // 🔹 ETAPA 2: Clasificar en reemplazos y agregados
    const idsExistentes = new Set(modulosExistentes.modulos.map(m => m.id.trim()));
    const reemplazos = [];
    const agregadosSinFiltrar = [];

    modulosNuevos.modulos.forEach(mod => {
      const idNuevo = mod.id.trim();
      if (idsExistentes.has(idNuevo)) {
        reemplazos.push(mod);
      } else {
        agregadosSinFiltrar.push(mod);
      }
    });

    // 🔹 FILTRAR hijos cuyos padres están en la lista de agregados
    const idsAgregados = new Set(agregadosSinFiltrar.map(m => m.id.trim()));
    const agregadosSinOrdenar = agregadosSinFiltrar.filter(mod => {
      const idMod = mod.id.trim();
      
      // Si NO es hijo, mantenerlo
      if (!idMod.includes('-S')) {
        return true;
      }
      
      // Es hijo: verificar si su padre está en agregados
      const numeroPadre = extraerNumeroBase(idMod);
      const idPadre = `MOD-${String(numeroPadre).padStart(3, '0')}:`;
      
      // Si el padre está en agregados, IGNORAR este hijo
      if (idsAgregados.has(idPadre)) {
        Logger.log(`⚠️ MOD-015: ${idMod} ignorado (su padre ${idPadre} está en agregados)`);
        return false;
      }
      
      // Si el padre NO está en agregados, mantener el hijo
      return true;
    });

    // 🔹 ORDENAR agregados por número (padres e hijos en secuencia numérica)
    const agregados = agregadosSinOrdenar.sort((a, b) => {
      const numA = extraerNumeroBase(a.id);
      const numB = extraerNumeroBase(b.id);
      
      // Primero por número base
      if (numA !== numB) {
        return numA - numB;
      }
      
      // Si tienen mismo número base, padres antes que hijos
      const esHijoA = a.id.includes('-S');
      const esHijoB = b.id.includes('-S');
      
      if (esHijoA !== esHijoB) {
        return esHijoA ? 1 : -1; // Padre primero
      }
      
      // Si ambos son hijos del mismo padre, ordenar por número de hijo
      if (esHijoA && esHijoB) {
        return extraerNumeroSubmodulo(a.id) - extraerNumeroSubmodulo(b.id);
      }
      
      return 0;
    });

    let codigoActualizado = codigoCompleto;
    let accionRealizada = '';

    // 🔹 ETAPA 3: Procesar TODOS los reemplazos primero
    if (reemplazos.length > 0) {
      for (const mod of reemplazos) {
        const resultado = reemplazarModulo(codigoActualizado, mod.id, mod.codigo);
        if (!resultado.success) {
          return { success: false, error: `Error reemplazando ${mod.id}: ${resultado.error}` };
        }
        codigoActualizado = resultado.codigo;
      }
      accionRealizada = 'reemplazado';
      Logger.log(`✅ MOD-015: ${reemplazos.length} módulo(s) reemplazado(s)`);
    }

    // 🔹 ETAPA 4: Procesar agregados uno por uno (LÓGICA SIMPLE + ORDENADOS)
    if (agregados.length > 0) {
      for (const modNuevo of agregados) {
        // Re-parsear para tener módulos actualizados después de cada inserción
        const modulosActualizados = parsearModulos(codigoActualizado);
        if (!modulosActualizados.success) {
          return { success: false, error: 'Error parseando código después de inserción' };
        }

        const resultado = agregarModuloIndividual(codigoActualizado, modNuevo, modulosActualizados.modulos);
        if (!resultado.success) {
          return { success: false, error: `Error agregando ${modNuevo.id}: ${resultado.error}` };
        }
        codigoActualizado = resultado.codigo;
      }
      accionRealizada = agregados.length === 1 ? 'agregado' : 'agregados';
      Logger.log(`✅ MOD-015: ${agregados.length} módulo(s) agregado(s)`);
    }

    const totalProcesados = reemplazos.length + agregados.length;
    
    // 🆕 ETAPA 5: Reenumerar si fue solicitado
    let reenumeracionRealizada = false;
    if (debeReenumerar) {
      const resultadoRenum = reenumerarModulosCompleto(codigoActualizado);
      
      if (resultadoRenum.success && resultadoRenum.codigo) {
        codigoActualizado = resultadoRenum.codigo;
        reenumeracionRealizada = true;
        Logger.log('✅ MOD-015: Reenumeración completada después de agregar');
      } else if (resultadoRenum.mensaje) {
        // No había cambios necesarios, pero no es error
        Logger.log(`ℹ️ MOD-015: ${resultadoRenum.mensaje}`);
      }
    }
    
    Logger.log(`✅ MOD-015 v6.0: ${totalProcesados} módulo(s) procesado(s) exitosamente`);

    return {
      success: true,
      codigo: codigoActualizado,
      accionRealizada: accionRealizada,
      modulosProcesados: totalProcesados,
      reemplazos: reemplazos.length,
      agregados: agregados.length,
      reenumerado: reenumeracionRealizada
    };

  } catch (error) {
    Logger.log('❌ Error MOD-015 v6.0: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-015-001: FIN


// MOD-015-002: AGREGAR MÓDULO INDIVIDUAL [INICIO]
/**
 * Agrega un módulo nuevo usando regla simple de líneas.
 * 
 * REGLA UNIVERSAL:
 * 1. Buscar ANTECESOR (ID inmediatamente anterior)
 *    - Si existe → insertar después de su línea FIN
 * 2. Si no hay antecesor, buscar SUCESOR (ID inmediatamente siguiente)
 *    - Si existe → insertar antes de su línea INICIO
 * 3. Si no hay ni antecesor ni sucesor → error (salvo MOD-001)
 * 
 * Aplica igual para padres e hijos.
 * No importa si el padre tiene hijos dentro o cuántos tenga.
 * 
 * @param {string} codigoCompleto - Código actual completo
 * @param {Object} modNuevo - Módulo a agregar {id, codigo}
 * @param {Array} modulosExistentes - Array de módulos existentes
 * @return {Object} {success, codigo?, error?}
 */
function agregarModuloIndividual(codigoCompleto, modNuevo, modulosExistentes) {
  try {
    const idNuevo = modNuevo.id.trim();
    
    // 🔹 PASO 1: Buscar ANTECESOR
    const antecesor = encontrarAntecesor(idNuevo, modulosExistentes);
    
    if (antecesor.existe) {
      // Insertar DESPUÉS del FIN del antecesor
      const posFin = encontrarPosicionFinModulo(codigoCompleto, antecesor.id);
      if (posFin === -1) {
        return { 
          success: false, 
          error: `No se encontró el FIN del antecesor ${antecesor.id}` 
        };
      }
      
      const antes = codigoCompleto.substring(0, posFin);
      const despues = codigoCompleto.substring(posFin);
      
      // Limpiar espacios extras al final y asegurar línea en blanco
      const antesTrimmed = antes.trimEnd();
      const codigoNuevo = antesTrimmed + '\n\n' + modNuevo.codigo.trim() + '\n' + despues;
      
      Logger.log(`✅ MOD-015: ${idNuevo} insertado después de ${antecesor.id}`);
      return { success: true, codigo: codigoNuevo };
    }
    
    // 🔹 PASO 2: No hay antecesor, buscar SUCESOR
    const sucesor = encontrarSucesor(idNuevo, modulosExistentes);
    
    if (sucesor.existe) {
      // Insertar ANTES del INICIO del sucesor
      const posInicio = encontrarPosicionInicioModulo(codigoCompleto, sucesor.id);
      if (posInicio === -1) {
        return { 
          success: false, 
          error: `No se encontró el INICIO del sucesor ${sucesor.id}` 
        };
      }
      
      const antes = codigoCompleto.substring(0, posInicio);
      const despues = codigoCompleto.substring(posInicio);
      
      // Asegurar línea en blanco después del módulo nuevo
      const codigoNuevo = antes + modNuevo.codigo.trim() + '\n\n' + despues;
      
      Logger.log(`✅ MOD-015: ${idNuevo} insertado antes de ${sucesor.id}`);
      return { success: true, codigo: codigoNuevo };
    }
    
    // 🔹 PASO 3: No hay ni antecesor ni sucesor
    return { 
      success: false, 
      error: `No se encontró posición para insertar ${idNuevo}. No hay antecesor ni sucesor.` 
    };

  } catch (error) {
    Logger.log(`❌ Error en agregarModuloIndividual: ${error.message}`);
    return { success: false, error: error.message };
  }
}
// MOD-015-002: FIN


// MOD-015-003: ENCONTRAR ANTECESOR [INICIO]
/**
 * Encuentra el antecesor (ID inmediatamente anterior) de un módulo.
 * Funciona igual para padres e hijos.
 * 
 * LÓGICA:
 * - Para PADRES (MOD-005): busca el MOD con número inmediatamente menor (MOD-004)
 * - Para HIJOS (MOD-005-S03): busca el hijo con número inmediatamente menor del MISMO padre (MOD-005-S02)
 * 
 * EJEMPLOS:
 * - MOD-005 → antecesor: MOD-004
 * - MOD-005-S01 → antecesor: ninguno (no hay S00)
 * - MOD-005-S03 → antecesor: MOD-005-S02
 * - MOD-005-S03A → antecesor: MOD-005-S03
 * 
 * @param {string} idBuscar - ID del módulo a agregar
 * @param {Array} modulos - Array de módulos existentes
 * @return {Object} {existe: boolean, id?: string}
 */
function encontrarAntecesor(idBuscar, modulos) {
  const numeroBaseBuscar = extraerNumeroBase(idBuscar);
  const esHijo = idBuscar.includes('-S');
  
  if (esHijo) {
    // 🔹 CASO HIJO: Buscar hijo anterior del mismo padre
    const numeroHijoBuscar = extraerNumeroSubmodulo(idBuscar);
    
    // Filtrar solo hijos del mismo padre
    const hijosDelMismoPadre = modulos.filter(m => {
      if (!m.id.includes('-S')) return false;
      const numBase = extraerNumeroBase(m.id);
      return numBase === numeroBaseBuscar;
    });
    
    // Buscar el hijo con número inmediatamente menor
    let mejorAntecesor = null;
    let menorDistancia = Infinity;
    
    for (const hijo of hijosDelMismoPadre) {
      const numHijo = extraerNumeroSubmodulo(hijo.id);
      if (numHijo < numeroHijoBuscar) {
        const distancia = numeroHijoBuscar - numHijo;
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          mejorAntecesor = hijo.id.trim();
        }
      }
    }
    
    return mejorAntecesor 
      ? { existe: true, id: mejorAntecesor } 
      : { existe: false };
    
  } else {
    // 🔹 CASO PADRE: Buscar MOD anterior
    const padres = modulos.filter(m => !m.id.includes('-S'));
    
    // 🔹 DEBUG: Loggear padres disponibles
    Logger.log(`🔍 Buscando antecesor para ${idBuscar}`);
    Logger.log(`📋 Padres disponibles: ${padres.map(p => p.id).join(', ')}`);
    
    // Buscar el padre con número inmediatamente menor
    let mejorAntecesor = null;
    let menorDistancia = Infinity;
    
    for (const padre of padres) {
      const numPadre = extraerNumeroBase(padre.id);
      if (numPadre < numeroBaseBuscar) {
        const distancia = numeroBaseBuscar - numPadre;
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          mejorAntecesor = padre.id.trim();
        }
      }
    }
    
    Logger.log(`✅ Antecesor encontrado: ${mejorAntecesor || 'ninguno'}`);
    
    return mejorAntecesor 
      ? { existe: true, id: mejorAntecesor } 
      : { existe: false };
  }
}
// MOD-015-003: FIN


// MOD-015-004: UTILIDADES DE PARSING [INICIO]
/**
 * Extrae número base del ID (MOD-005 → 5, MOD-004-S01 → 4)
 */
function extraerNumeroBase(id) {
  const match = id.match(/MOD-(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Extrae número de submódulo (MOD-004-S01 → 1)
 */
function extraerNumeroSubmodulo(id) {
  const match = id.match(/S(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Verifica si MOD-001 es válido sin predecesor
 */
function esPrimeroValido(id) {
  return extraerNumeroBase(id) === 1;
}
// MOD-015-004: FIN


// MOD-015-005: ENCONTRAR POSICIONES [INICIO]
/**
 * Encuentra posición exacta del FIN de un módulo.
 * Retorna la posición INCLUYENDO el salto de línea final.
 * 
 * @param {string} codigo - Código completo
 * @param {string} idModulo - ID del módulo (ej: "MOD-005:")
 * @return {number} Posición después del FIN, o -1 si no se encuentra
 */
function encontrarPosicionFinModulo(codigo, idModulo) {
  const lineas = codigo.split('\n');
  let posicionCaracter = 0;
  
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const lineaOriginal = linea; // Mantener espacios originales
    
    // Buscar patrón FIN exacto (usando misma lógica que MOD-009)
    if (linea.trim().includes(idModulo.trim() + ' FIN')) {
      return posicionCaracter + lineaOriginal.length + 1; // +1 para incluir el \n
    }
    
    posicionCaracter += lineaOriginal.length + 1; // +1 por \n
  }
  
  return -1;
}

/**
 * Encuentra posición exacta del INICIO de un módulo.
 * Retorna la posición al COMIENZO de la línea [INICIO].
 * 
 * @param {string} codigo - Código completo
 * @param {string} idModulo - ID del módulo (ej: "MOD-005:")
 * @return {number} Posición al inicio de la línea [INICIO], o -1 si no se encuentra
 */
function encontrarPosicionInicioModulo(codigo, idModulo) {
  const lineas = codigo.split('\n');
  let posicionCaracter = 0;
  
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const lineaOriginal = linea; // Mantener espacios originales
    
    // Buscar patrón INICIO (ID + cualquier texto + [INICIO])
    if (linea.trim().includes(idModulo.trim()) && linea.includes('[INICIO]')) {
      return posicionCaracter; // Retornar inicio de la línea
    }
    
    posicionCaracter += lineaOriginal.length + 1; // +1 por \n
  }
  
  return -1;
}
// MOD-015-005: FIN


// MOD-015-006: NORMALIZAR ESPACIADO [INICIO]
/**
 * Normaliza el espaciado de todos los módulos del código.
 * Asegura 1 línea en blanco después de cada delimitador FIN.
 * 
 * PROCESO:
 * 1. Detecta todos los delimitadores FIN
 * 2. Asegura que cada FIN tenga exactamente 1 línea en blanco después
 * 3. Retorna código con espaciado consistente
 * 
 * @param {string} codigo - Código completo con módulos
 * @return {string} Código con espaciado normalizado
 */
function normalizarEspaciadoModulos(codigo) {
  try {
    if (!codigo || typeof codigo !== 'string') {
      return codigo;
    }

    const lineas = codigo.split('\n');
    const resultado = [];
    
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      resultado.push(linea);
      
      // Detectar si es un delimitador FIN
      const esFin = /MOD-\d{3}[A-Z]?(-S\d{2}[A-Z]?)?\s*:\s*FIN/i.test(linea.trim());
      
      if (esFin && i < lineas.length - 1) {
        // Verificar si ya hay línea en blanco después
        const siguienteLinea = lineas[i + 1];
        
        if (siguienteLinea && siguienteLinea.trim() !== '') {
          // No hay línea en blanco, agregar una
          resultado.push('');
        }
        // Si ya hay línea en blanco (siguienteLinea.trim() === ''), no hacer nada
      }
    }
    
    Logger.log('✅ MOD-015-S06: Espaciado normalizado');
    return resultado.join('\n');
    
  } catch (error) {
    Logger.log('⚠️ Error normalizando espaciado: ' + error.message);
    return codigo; // Retornar código original si falla
  }
}
// MOD-015-006: FIN


// MOD-015-007: ENCONTRAR SUCESOR [INICIO]
/**
 * Encuentra el sucesor (ID inmediatamente siguiente) de un módulo.
 * Funciona igual para padres e hijos.
 * 
 * LÓGICA:
 * - Para PADRES (MOD-001): busca el MOD con número inmediatamente mayor (MOD-002)
 * - Para HIJOS (MOD-005-S01): busca el hijo con número inmediatamente mayor del MISMO padre (MOD-005-S02)
 * 
 * EJEMPLOS:
 * - MOD-001 → sucesor: MOD-002
 * - MOD-005-S01 → sucesor: MOD-005-S02
 * - MOD-005-S03A → sucesor: MOD-005-S04
 * 
 * @param {string} idBuscar - ID del módulo a agregar
 * @param {Array} modulos - Array de módulos existentes
 * @return {Object} {existe: boolean, id?: string}
 */
function encontrarSucesor(idBuscar, modulos) {
  const numeroBaseBuscar = extraerNumeroBase(idBuscar);
  const esHijo = idBuscar.includes('-S');
  
  if (esHijo) {
    // 🔹 CASO HIJO: Buscar hijo siguiente del mismo padre
    const numeroHijoBuscar = extraerNumeroSubmodulo(idBuscar);
    
    // Filtrar solo hijos del mismo padre
    const hijosDelMismoPadre = modulos.filter(m => {
      if (!m.id.includes('-S')) return false;
      const numBase = extraerNumeroBase(m.id);
      return numBase === numeroBaseBuscar;
    });
    
    // Buscar el hijo con número inmediatamente mayor
    let mejorSucesor = null;
    let menorDistancia = Infinity;
    
    for (const hijo of hijosDelMismoPadre) {
      const numHijo = extraerNumeroSubmodulo(hijo.id);
      if (numHijo > numeroHijoBuscar) {
        const distancia = numHijo - numeroHijoBuscar;
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          mejorSucesor = hijo.id.trim();
        }
      }
    }
    
    return mejorSucesor 
      ? { existe: true, id: mejorSucesor } 
      : { existe: false };
    
  } else {
    // 🔹 CASO PADRE: Buscar MOD siguiente
    const padres = modulos.filter(m => !m.id.includes('-S'));
    
    // Buscar el padre con número inmediatamente mayor
    let mejorSucesor = null;
    let menorDistancia = Infinity;
    
    for (const padre of padres) {
      const numPadre = extraerNumeroBase(padre.id);
      if (numPadre > numeroBaseBuscar) {
        const distancia = numPadre - numeroBaseBuscar;
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          mejorSucesor = padre.id.trim();
        }
      }
    }
    
    return mejorSucesor 
      ? { existe: true, id: mejorSucesor } 
      : { existe: false };
  }
}
// MOD-015-007: FIN

// MOD-015: FIN

// MOD-016: RENUMERAR PADRES [INICIO]
/**
 * Genera mapeo de reenumeración para módulos PADRES.
 * Renumera secuencialmente eliminando letras intermedias.
 * 
 * PROCESO:
 * - Itera módulos ordenados
 * - Solo procesa módulos SIN -S (padres)
 * - Asigna números secuenciales: 001, 002, 003...
 * - Guarda mapeo para que los hijos lo hereden
 * 
 * @param {Array} modulos - Array de módulos ordenados
 * @param {Object} padresNuevos - Diccionario para guardar mapeo {numeroViejo: numeroNuevo}
 * @return {Object} Mapeo de padres {idViejo: idNuevo}
 */
function reenumerarPadres(modulos, padresNuevos) {
  try {
    const mapeo = {};
    let contador = 1;
    
    Logger.log('📋 Renumerando PADRES...');
    
    for (const mod of modulos) {
      const idViejo = mod.id.trim();
      
      // Solo procesar módulos PADRES (sin -S)
      if (!idViejo.includes('-S')) {
        
        // Extraer número actual (con o sin letra)
        // Formato: MOD-002A: o MOD-003:
        const match = idViejo.match(/MOD-(\d{3})([A-Z]*):/i);
        
        if (match) {
          const numeroViejo = match[1];
          const numeroNuevo = String(contador).padStart(3, '0');
          
          // Guardar en diccionario de padres (para que hijos lo usen)
          padresNuevos[numeroViejo] = numeroNuevo;
          
          // Generar nuevo ID
          const idNuevo = `MOD-${numeroNuevo}:`;
          
          // Solo agregar al mapeo si hay cambio
          if (idViejo !== idNuevo) {
            mapeo[idViejo] = idNuevo;
            Logger.log(`  ${idViejo} → ${idNuevo}`);
          }
          
          contador++;
        }
      }
    }
    
    Logger.log(`✅ ${Object.keys(mapeo).length} padres renumerados`);
    
    return mapeo;
    
  } catch (error) {
    Logger.log('❌ Error en reenumerarPadres: ' + error.message);
    return {};
  }
}
// MOD-016: FIN

// MOD-016-001: FUNCIÓN PRINCIPAL REENUMERADOR [INICIO]
/**
 * Reenumera todos los módulos desde el primer intermedio detectado.
 * Cierra gaps automáticamente y convierte el último MOD a MOD-099.
 * 
 * PROCESO:
 * 1. Parsear y ordenar todos los módulos
 * 2. Detectar primer intermedio (padre o hijo con letra)
 * 3. Generar mapeo completo de reenumeración
 * 4. Aplicar reenumeración en el código
 * 5. Convertir último MOD a MOD-099
 * 
 * @param {string} codigoCompleto - Código original completo
 * @return {Object} {success, codigo?, estadisticas?, error?}
 */
function reenumerarModulos(codigoCompleto) {
  try {
    if (!codigoCompleto || typeof codigoCompleto !== 'string') {
      return { success: false, error: 'Código inválido o vacío' };
    }

    // 🔹 ETAPA 1: Parsear y ordenar módulos
    const resultadoParseo = parsearModulos(codigoCompleto);
    if (!resultadoParseo.success) {
      return { success: false, error: 'No se pudieron parsear módulos' };
    }

    const modulosOrdenados = ordenarModulos(resultadoParseo.modulos);
    if (modulosOrdenados.length === 0) {
      return { success: false, error: 'No hay módulos para reenumerar' };
    }

    // 🔹 ETAPA 2: Detectar primer intermedio
    const puntoInicio = detectarPrimerIntermedio(modulosOrdenados);
    
    if (!puntoInicio.encontrado) {
      return { 
        success: true, 
        codigo: codigoCompleto,
        mensaje: 'No se detectaron módulos intermedios. No es necesaria reenumeración.'
      };
    }

    Logger.log(`🔍 Primer intermedio detectado: ${puntoInicio.id} (tipo: ${puntoInicio.tipo})`);

    // 🔹 ETAPA 3: Generar mapeo de reenumeración
    const mapeo = generarMapeoRenumeracion(modulosOrdenados, puntoInicio);
    
    if (Object.keys(mapeo).length === 0) {
      return { 
        success: true, 
        codigo: codigoCompleto,
        mensaje: 'No hay cambios necesarios.'
      };
    }

    Logger.log(`📋 Mapeo generado: ${Object.keys(mapeo).length} cambios`);

    // 🔹 ETAPA 4: Aplicar reenumeración
    let codigoRenumerado = aplicarRenumeracionCodigo(codigoCompleto, mapeo);

    // 🔹 ETAPA 5: Convertir último MOD a 099
    codigoRenumerado = convertirUltimoA099(codigoRenumerado);

    Logger.log('✅ MOD-016: Reenumeración completada exitosamente');

    return {
      success: true,
      codigo: codigoRenumerado,
      estadisticas: {
        modulosProcesados: Object.keys(mapeo).length,
        primerIntermedio: puntoInicio.id,
        tipo: puntoInicio.tipo
      }
    };

  } catch (error) {
    Logger.log('❌ Error MOD-016: ' + error.message);
    return { success: false, error: error.message };
  }
}
// MOD-016-001: FIN

// MOD-016-002: DETECTAR PRIMER INTERMEDIO [INICIO]
/**
 * Detecta el primer módulo con letra (intermedio).
 * Busca tanto en MODs padres como en SubMODs.
 * 
 * EJEMPLOS:
 * - MOD-002A (padre intermedio)
 * - MOD-005-S01R (hijo intermedio)
 * 
 * @param {Array} modulos - Array de módulos ordenados
 * @return {Object} {encontrado: boolean, tipo: 'padre'|'hijo', indice: number, id: string}
 */
function detectarPrimerIntermedio(modulos) {
  try {
    // Buscar en MODs padres primero
    for (let i = 0; i < modulos.length; i++) {
      const mod = modulos[i];
      const id = mod.id.trim();
      
      // Detectar si es SubMOD
      const esSubmod = id.includes('-S');
      
      if (!esSubmod) {
        // MOD padre: buscar letra después del número
        // Formato: MOD-002A: o MOD-002AB:
        const match = id.match(/MOD-(\d{3})([A-Z]+):/i);
        if (match) {
          return {
            encontrado: true,
            tipo: 'padre',
            indice: i,
            id: id,
            numeroBase: parseInt(match[1]),
            letra: match[2]
          };
        }
      } else {
        // SubMOD: buscar letra después del número de submódulo
        // Formato: MOD-005-S01A: o MOD-005-S01AB:
        const match = id.match(/MOD-(\d{3})-S(\d{2})([A-Z]+):/i);
        if (match) {
          return {
            encontrado: true,
            tipo: 'hijo',
            indice: i,
            id: id,
            numeroBase: parseInt(match[1]),
            numeroSub: parseInt(match[2]),
            letra: match[3]
          };
        }
      }
    }

    return { encontrado: false };

  } catch (error) {
    Logger.log('❌ Error detectando primer intermedio: ' + error.message);
    return { encontrado: false };
  }
}
// MOD-016-002: FIN

// MOD-016-003: GENERAR MAPEO COMPLETO [INICIO]
/**
 * Genera mapeo completo de reenumeración.
 * 
 * CASOS CUBIERTOS:
 * A) MODs padres con letra → reenumeración secuencial
 * B) SubMODs heredan cambio del padre (MOD-004-S01 → MOD-005-S01)
 * C) SubMODs intermedios → reenumeración local dentro del padre
 * 
 * @param {Array} modulos - Array de módulos ordenados
 * @param {Object} puntoInicio - Resultado de detectarPrimerIntermedio()
 * @return {Object} Diccionario de mapeo (ID_VIEJO: ID_NUEVO)
 */
function generarMapeoRenumeracion(modulos, puntoInicio) {
  try {
    const mapeo = {};

    if (puntoInicio.tipo === 'padre') {
      // CASO A: Reenumeración de MODs padres
      generarMapeoPadres(modulos, puntoInicio, mapeo);
    } else if (puntoInicio.tipo === 'hijo') {
      // CASO C: Reenumeración local de SubMODs
      generarMapeoHijosLocales(modulos, puntoInicio, mapeo);
    }

    return mapeo;

  } catch (error) {
    Logger.log('❌ Error generando mapeo: ' + error.message);
    return {};
  }
}

/**
 * Genera mapeo para MODs padres y sus hijos heredan el cambio.
 */
function generarMapeoPadres(modulos, puntoInicio, mapeo) {
  let contadorNuevo = puntoInicio.numeroBase;

  for (let i = puntoInicio.indice; i < modulos.length; i++) {
    const mod = modulos[i];
    const idViejo = mod.id.trim();
    
    const esSubmod = idViejo.includes('-S');
    
    if (!esSubmod) {
      // MOD padre: reenumerar secuencialmente
      const match = idViejo.match(/MOD-(\d{3})([A-Z]*):/i);
      if (match) {
        const numeroViejo = parseInt(match[1]);
        const idNuevo = `MOD-${String(contadorNuevo).padStart(3, '0')}:`;
        
        if (idViejo !== idNuevo) {
          mapeo[idViejo] = idNuevo;
          Logger.log(`  ${idViejo} → ${idNuevo}`);
        }
        
        contadorNuevo++;
      }
    } else {
      // SubMOD: heredar cambio del padre
      const match = idViejo.match(/MOD-(\d{3})-S(\d{2})([A-Z]*):/i);
      if (match) {
        const numeroPadreViejo = parseInt(match[1]);
        const numeroSub = match[2];
        const letra = match[3];
        
        // Buscar si el padre cambió
        const idPadreViejo = `MOD-${String(numeroPadreViejo).padStart(3, '0')}:`;
        
        if (mapeo[idPadreViejo]) {
          // El padre cambió, heredar el nuevo número
          const matchPadreNuevo = mapeo[idPadreViejo].match(/MOD-(\d{3}):/);
          if (matchPadreNuevo) {
            const numeroPadreNuevo = matchPadreNuevo[1];
            const idNuevo = `MOD-${numeroPadreNuevo}-S${numeroSub}${letra}:`;
            
            if (idViejo !== idNuevo) {
              mapeo[idViejo] = idNuevo;
              Logger.log(`  ${idViejo} → ${idNuevo} (herencia)`);
            }
          }
        }
      }
    }
  }
}

/**
 * Genera mapeo para SubMODs con intermedios (reenumeración local).
 */
function generarMapeoHijosLocales(modulos, puntoInicio, mapeo) {
  const numeroPadre = puntoInicio.numeroBase;
  
  // Filtrar solo los SubMODs del mismo padre
  const hijosDelPadre = modulos.filter(m => {
    const match = m.id.match(/MOD-(\d{3})-S/);
    return match && parseInt(match[1]) === numeroPadre;
  });

  // Encontrar el índice del hijo intermedio dentro de los hijos del padre
  let indiceHijoIntermedio = -1;
  for (let i = 0; i < hijosDelPadre.length; i++) {
    if (hijosDelPadre[i].id.trim() === puntoInicio.id) {
      indiceHijoIntermedio = i;
      break;
    }
  }

  if (indiceHijoIntermedio === -1) return;

  // Reenumerar desde el hijo intermedio en adelante
  let contadorSub = puntoInicio.numeroSub;

  for (let i = indiceHijoIntermedio; i < hijosDelPadre.length; i++) {
    const hijo = hijosDelPadre[i];
    const idViejo = hijo.id.trim();
    
    const match = idViejo.match(/MOD-(\d{3})-S(\d{2})([A-Z]*):/i);
    if (match) {
      const numPadre = match[1];
      const idNuevo = `MOD-${numPadre}-S${String(contadorSub).padStart(2, '0')}:`;
      
      if (idViejo !== idNuevo) {
        mapeo[idViejo] = idNuevo;
        Logger.log(`  ${idViejo} → ${idNuevo} (local)`);
      }
      
      contadorSub++;
    }
  }
}
// MOD-016-003: FIN

// MOD-016-004: APLICAR REENUMERACIÓN [INICIO]
/**
 * Aplica el mapeo de reenumeración al código completo.
 * ULTRA AGNÓSTICO: Detecta dinámicamente prefijo/sufijo de cada módulo.
 * 
 * FILOSOFÍA (heredada de MOD-009):
 * 1. Buscar módulo original en el código
 * 2. Extraer su prefijo y sufijo dinámicamente
 * 3. Reemplazar bloque completo preservando formato
 * 
 * ORDEN DE APLICACIÓN:
 * - Aplica cambios en orden INVERSO (mayor a menor) para evitar colisiones
 * - Ejemplo: MOD-006→007, MOD-005→006, MOD-004→005 (no al revés)
 * 
 * Reemplaza IDs en delimitadores [INICIO] y FIN sin asumir tipo de comentario.
 * Funciona con cualquier prefijo: //, --, II, EE, Zz, <45>, etc.
 * 
 * @param {string} codigo - Código original
 * @param {Object} mapeo - Diccionario de reenumeración {idViejo: idNuevo}
 * @return {string} Código con IDs actualizados
 */
function aplicarRenumeracionCodigo(codigo, mapeo) {
  try {
    let codigoActualizado = codigo;

    // 🔹 PASO 0: Ordenar mapeo en orden INVERSO (mayor a menor)
    // Para evitar colisiones al renumerar
    const mapeoOrdenado = Object.entries(mapeo).sort((a, b) => {
      // Extraer números de los IDs
      const numA = extraerNumeroCompleto(a[0]);
      const numB = extraerNumeroCompleto(b[0]);
      return numB - numA; // Mayor a menor (inverso)
    });

    // Aplicar cada cambio del mapeo en orden inverso
    for (const [idViejo, idNuevo] of mapeoOrdenado) {
      // 🔹 PASO 1: Buscar módulo original y extraer prefijo/sufijo
      const moduloOriginal = buscarModuloOriginal(codigoActualizado, idViejo);
      
      if (!moduloOriginal.success) {
        Logger.log(`⚠️ ${idViejo} no encontrado, omitiendo...`);
        continue;
      }

      const prefijo = moduloOriginal.prefijo;
      const sufijo = moduloOriginal.sufijo;

      // 🔹 PASO 2: Encontrar posición exacta del módulo
      const posiciones = encontrarPosicionModulo(codigoActualizado, idViejo, prefijo, sufijo);
      
      if (!posiciones.success) {
        Logger.log(`⚠️ No se pudo localizar ${idViejo}, omitiendo...`);
        continue;
      }

      // 🔹 PASO 3: Extraer el bloque completo del módulo
      const bloqueOriginal = codigoActualizado.substring(posiciones.inicio, posiciones.fin);

      // 🔹 PASO 4: Reemplazar IDs en el bloque (INICIO y FIN)
      const idViejoSinDospuntos = idViejo.replace(/:$/, '');
      const idNuevoSinDospuntos = idNuevo.replace(/:$/, '');

      // Escapar caracteres especiales en el ID para regex
      const idViejoEscapado = idViejoSinDospuntos.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Reemplazar en INICIO (ID + : + descripción + [INICIO])
      const patronInicio = new RegExp(
        `(${idViejoEscapado})(:\\s*[^\\[]*\\[INICIO\\])`,
        'g'
      );
      
      let bloqueNuevo = bloqueOriginal.replace(
        patronInicio,
        `${idNuevoSinDospuntos}$2`
      );

      // Reemplazar en FIN (ID + : FIN)
      const patronFin = new RegExp(
        `(${idViejoEscapado})(:\\s*FIN)`,
        'g'
      );
      
      bloqueNuevo = bloqueNuevo.replace(
        patronFin,
        `${idNuevoSinDospuntos}$2`
      );

      // 🔹 PASO 5: Reemplazar el bloque en el código
      const antes = codigoActualizado.substring(0, posiciones.inicio);
      const despues = codigoActualizado.substring(posiciones.fin);
      codigoActualizado = antes + bloqueNuevo + despues;

      Logger.log(`  ✅ ${idViejo} → ${idNuevo} aplicado`);
    }

    return codigoActualizado;

  } catch (error) {
    Logger.log('❌ Error aplicando reenumeración: ' + error.message);
    return codigo;
  }
}

/**
 * Extrae el número completo de un ID para ordenamiento.
 * MOD-002A: → 2.01 (letra A = .01)
 * MOD-003: → 3.0
 * MOD-004-S01: → 4.01
 * MOD-004-S01A: → 4.011
 * 
 * @param {string} id - ID del módulo (ej: "MOD-003:", "MOD-004-S01A:")
 * @return {number} Número para ordenamiento
 */
function extraerNumeroCompleto(id) {
  // Quitar dos puntos finales
  const idLimpio = id.replace(/:$/, '');
  
  // Extraer componentes: MOD-XXX[letra][-SYY[letra]]
  const match = idLimpio.match(/MOD-(\d+)([A-Z])?(?:-S(\d+)([A-Z])?)?/);
  
  if (!match) return 0;
  
  const numBase = parseInt(match[1], 10);
  const letraBase = match[2] ? match[2].charCodeAt(0) - 64 : 0; // A=1, B=2, etc.
  const numSub = match[3] ? parseInt(match[3], 10) : 0;
  const letraSub = match[4] ? match[4].charCodeAt(0) - 64 : 0;
  
  // Fórmula: base + (letra/100) + (sub/1000) + (letraSub/100000)
  return numBase + (letraBase / 100) + (numSub / 1000) + (letraSub / 100000);
}
// MOD-016-004: FIN

// MOD-016-005: CONVERTIR ÚLTIMO A 099 [INICIO]
/**
 * Convierte el último MOD padre a MOD-099.
 * 
 * @param {string} codigo - Código con reenumeración aplicada
 * @return {string} Código con último MOD convertido a 099
 */
function convertirUltimoA099(codigo) {
  try {
    // Parsear módulos después de la reenumeración
    const resultado = parsearModulos(codigo);
    if (!resultado.success) {
      return codigo;
    }

    const modulos = resultado.modulos;
    
    // Encontrar último MOD padre (sin -S)
    let ultimoPadre = null;
    for (let i = modulos.length - 1; i >= 0; i--) {
      const mod = modulos[i];
      if (!mod.id.includes('-S')) {
        ultimoPadre = mod;
        break;
      }
    }

    if (!ultimoPadre) {
      return codigo;
    }

    const idUltimoPadre = ultimoPadre.id.trim();

    // Si ya es MOD-099:, no hacer nada
    if (idUltimoPadre === 'MOD-099:') {
      return codigo;
    }

    // Extraer número del último padre
    const match = idUltimoPadre.match(/MOD-(\d{3}):/);
    if (!match) {
      return codigo;
    }

    const numeroUltimo = match[1];
    const idViejoSinDospuntos = `MOD-${numeroUltimo}`;
    const idNuevoSinDospuntos = 'MOD-099';

    Logger.log(`🔄 Convirtiendo ${idViejoSinDospuntos} a ${idNuevoSinDospuntos}`);

    let codigoActualizado = codigo;

    // Reemplazar el MOD padre
    const patronInicioPadre = new RegExp(
      `((?:<!--|//|/\\*)\\s*)${idViejoSinDospuntos}(:\\s*[^\\[]*\\[INICIO\\][^\\n]*)`,
      'g'
    );
    codigoActualizado = codigoActualizado.replace(patronInicioPadre, `$1${idNuevoSinDospuntos}$2`);

    const patronFinPadre = new RegExp(
      `((?:<!--|//|/\\*)\\s*)${idViejoSinDospuntos}(:\\s*FIN[^\\n]*)`,
      'g'
    );
    codigoActualizado = codigoActualizado.replace(patronFinPadre, `$1${idNuevoSinDospuntos}$2`);

    // Reemplazar sus hijos si los tiene
    const patronInicioHijos = new RegExp(
      `((?:<!--|//|/\\*)\\s*)${idViejoSinDospuntos}(-S\\d{2}[A-Z]*:\\s*[^\\[]*\\[INICIO\\][^\\n]*)`,
      'g'
    );
    codigoActualizado = codigoActualizado.replace(patronInicioHijos, `$1${idNuevoSinDospuntos}$2`);

    const patronFinHijos = new RegExp(
      `((?:<!--|//|/\\*)\\s*)${idViejoSinDospuntos}(-S\\d{2}[A-Z]*:\\s*FIN[^\\n]*)`,
      'g'
    );
    codigoActualizado = codigoActualizado.replace(patronFinHijos, `$1${idNuevoSinDospuntos}$2`);

    return codigoActualizado;

  } catch (error) {
    Logger.log('❌ Error convirtiendo último a 099: ' + error.message);
    return codigo;
  }
}
// MOD-016-005: FIN

// MOD-017: RENUMERAR HIJOS [INICIO]
/**
 * Genera mapeo de reenumeración para módulos HIJOS.
 * Los hijos heredan el nuevo número del padre automáticamente.
 * Renumera secuencialmente EN ORDEN DE APARICIÓN (no alfabético).
 * 
 * CRÍTICO: Respeta el orden físico del código, no el orden alfabético.
 * - MOD-004-S01A aparece primero → se convierte en S01
 * - MOD-004-S01 aparece después → se convierte en S02
 * 
 * SOPORTA PADRES CON LETRAS:
 * - MOD-005A-S01 → Padre 005A se renumera a 007, hijo queda como 007-S01
 * 
 * PROCESO:
 * - Itera módulos EN ORDEN DE PARSEADO (orden físico del código)
 * - Solo procesa módulos CON -S (hijos)
 * - Hereda el nuevo número del padre
 * - Renumera hijos secuencialmente dentro del grupo: S01, S02, S03...
 * - Elimina letras intermedias (S01A → S01)
 * 
 * @param {Array} modulos - Array de módulos EN ORDEN FÍSICO (no ordenar antes)
 * @param {Object} padresNuevos - Diccionario con mapeo de padres {numeroViejo: numeroNuevo}
 * @return {Object} Mapeo de hijos {idViejo: idNuevo}
 */
function reenumerarHijos(modulos, padresNuevos) {
  try {
    const mapeo = {};
    const gruposHijos = {};  // {numeroPadreNuevo: contadorHijos}
    
    Logger.log('📋 Renumerando HIJOS...');
    
    // IMPORTANTE: Procesar en orden de aparición, NO alfabético
    for (const mod of modulos) {
      const idViejo = mod.id.trim();
      
      // Solo procesar módulos HIJOS (con -S)
      if (idViejo.includes('-S')) {
        
        // Extraer información del hijo
        // Formato: MOD-004-S01A: o MOD-004-S02: o MOD-005A-S01:
        // Soporta letras tanto en padre como en hijo
        const match = idViejo.match(/MOD-(\d{3})([A-Z]*)-S(\d{2})([A-Z]*):/i);
        
        if (match) {
          const numeroPadreViejo = match[1];  // Ej: "005"
          const letraPadreVieja = match[2];   // Ej: "A" o ""
          // const numeroHijoViejo = match[3]; // No lo necesitamos
          // const letraHijoVieja = match[4];  // No lo necesitamos
          
          // Buscar el nuevo número del padre
          // Puede estar en padresNuevos como "005" o como "005A"
          let numeroPadreNuevo = padresNuevos[numeroPadreViejo];
          
          // Si el padre tenía letra, buscar con letra también
          if (letraPadreVieja && !numeroPadreNuevo) {
            numeroPadreNuevo = padresNuevos[numeroPadreViejo + letraPadreVieja];
          }
          
          // Si el padre no cambió, usar el número viejo
          const numPadre = numeroPadreNuevo || numeroPadreViejo;
          
          // Inicializar contador de hijos para este padre si no existe
          if (!gruposHijos[numPadre]) {
            gruposHijos[numPadre] = 1;
          }
          
          // Asignar número secuencial al hijo
          const numeroHijo = String(gruposHijos[numPadre]).padStart(2, '0');
          
          // Generar nuevo ID
          const idNuevo = `MOD-${numPadre}-S${numeroHijo}:`;
          
          // Solo agregar al mapeo si hay cambio
          if (idViejo !== idNuevo) {
            mapeo[idViejo] = idNuevo;
            Logger.log(`  ${idViejo} → ${idNuevo}`);
          }
          
          // Incrementar contador de hijos para este padre
          gruposHijos[numPadre]++;
        }
      }
    }
    
    Logger.log(`✅ ${Object.keys(mapeo).length} hijos renumerados`);
    
    return mapeo;
    
  } catch (error) {
    Logger.log('❌ Error en reenumerarHijos: ' + error.message);
    return {};
  }
}
// MOD-017: FIN

// MOD-018: REENUMERACIÓN TOTAL [INICIO]
/**
 * Función orquestadora: reenumera TODO el código.
 * Mantiene jerarquía padre-hijo.
 * Elimina letras intermedias de padres e hijos.
 * 
 * PROCESO COMPLETO:
 * 1. Parsear y ordenar todos los módulos
 * 2. Renumerar padres secuencialmente (MOD-016)
 * 3. Detectar hijos en ORDEN FÍSICO del código
 * 4. Renumerar hijos heredando cambios (MOD-017)
 * 5. Combinar ambos mapeos
 * 6. Aplicar todos los cambios al código
 * 
 * EJEMPLO:
 * Entrada:  MOD-001, MOD-002, MOD-002A, MOD-003, MOD-004, MOD-004-S01A, MOD-004-S01
 * Salida:   MOD-001, MOD-002, MOD-003, MOD-004, MOD-005, MOD-005-S01, MOD-005-S02
 * 
 * @param {string} codigoOriginal - Código completo a reenumerar
 * @return {Object} {success, codigo?, estadisticas?, mensaje?, error?}
 */
function reenumerarModulosCompleto(codigoOriginal) {
  try {
    if (!codigoOriginal || typeof codigoOriginal !== 'string') {
      return { success: false, error: 'Código inválido o vacío' };
    }

    Logger.log('🔢 REENUMERACIÓN TOTAL INICIADA');
    Logger.log('═══════════════════════════════════════');

    // 🔹 PASO 1: Parsear módulos
    const resultado = parsearModulos(codigoOriginal);
    if (!resultado.success) {
      return { success: false, error: 'Error al parsear módulos: ' + resultado.error };
    }

    Logger.log(`✅ ${resultado.modulos.length} módulos parseados`);

    // 🔹 PASO 2: Ordenar módulos (SOLO PARA PADRES)
    const ordenados = ordenarModulos(resultado.modulos);
    
    if (ordenados.length === 0) {
      return { 
        success: true, 
        codigo: codigoOriginal,
        mensaje: 'No hay módulos para reenumerar'
      };
    }

    Logger.log(`✅ ${ordenados.length} módulos ordenados`);

    // 🔹 PASO 3: Renumerar PADRES (usa módulos ordenados)
    const padresNuevos = {};  // Diccionario compartido
    const mapeoPadres = reenumerarPadres(ordenados, padresNuevos);

    // 🔹 PASO 4: Detectar hijos en ORDEN FÍSICO del código
    const hijosOrdenFisico = detectarHijosOrdenFisico(codigoOriginal);
    
    // 🔹 PASO 5: Renumerar HIJOS (usa hijos en orden físico)
    const mapeoHijos = reenumerarHijos(hijosOrdenFisico, padresNuevos);

    // 🔹 PASO 6: Combinar mapeos
    const mapeoCompleto = { ...mapeoPadres, ...mapeoHijos };

    if (Object.keys(mapeoCompleto).length === 0) {
      Logger.log('ℹ️ No hay cambios necesarios');
      return { 
        success: true, 
        codigo: codigoOriginal,
        mensaje: 'No hay módulos intermedios. No es necesaria reenumeración.'
      };
    }

    Logger.log(`📊 Total de cambios: ${Object.keys(mapeoCompleto).length}`);

    // 🔹 PASO 7: Aplicar mapeo completo al código
    const codigoNuevo = aplicarRenumeracionCodigo(codigoOriginal, mapeoCompleto);

    Logger.log('═══════════════════════════════════════');
    Logger.log('✅ REENUMERACIÓN TOTAL COMPLETADA');

    return {
      success: true,
      codigo: codigoNuevo,
      estadisticas: {
        padresRenumerados: Object.keys(mapeoPadres).length,
        hijosRenumerados: Object.keys(mapeoHijos).length,
        totalCambios: Object.keys(mapeoCompleto).length
      }
    };

  } catch (error) {
    Logger.log('❌ Error en reenumerarModulosCompleto: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Detecta módulos hijos en orden físico del código (orden de aparición).
 * NO usa parsearModulos() para evitar que los ordene alfabéticamente.
 * 
 * Busca línea por línea los delimitadores [INICIO] de hijos (con -S).
 * Soporta padres con letras: MOD-005A-S01, MOD-003B-S02, etc.
 * Retorna array con solo los hijos en el orden exacto que aparecen.
 * 
 * @param {string} codigo - Código completo
 * @return {Array} Array de objetos {id: "MOD-XXX-SYY:"} en orden físico
 */
function detectarHijosOrdenFisico(codigo) {
  const hijos = [];
  const lineas = codigo.split('\n');
  
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    
    // Buscar patrón: cualquier cosa + MOD-XXX-S + [INICIO]
    // Debe contener -S para ser hijo
    if (!linea.includes('-S')) continue;
    if (!linea.includes('[INICIO]')) continue;
    
    // Extraer el ID del hijo
    // Formato: [prefijo] MOD-XXX[letra]-SYY[letra]: [descripción] [INICIO] [sufijo]
    // Acepta letras tanto en el padre como en el hijo: MOD-005A-S01B:
    const match = linea.match(/MOD-\d{3}[A-Z]*-S\d{2}[A-Z]*:/i);
    
    if (match) {
      const idHijo = match[0]; // Ej: "MOD-004-S01A:" o "MOD-005A-S01:"
      hijos.push({ id: idHijo });
      Logger.log(`  📍 Hijo detectado en orden físico: ${idHijo}`);
    }
  }
  
  Logger.log(`✅ ${hijos.length} hijos detectados en orden físico`);
  return hijos;
}
// MOD-018: FIN

// MOD-019: ELIMINAR MÓDULOS [INICIO]
/**
 * Elimina módulos seleccionados del código.
 * Realiza deduplicación automática (ignora hijos si su padre está marcado).
 * Opcionalmente reenumera después de eliminar.
 * 
 * COMPORTAMIENTO:
 * - Eliminación dura: borra todo entre delimitadores [INICIO] y FIN
 * - Deduplicación automática: si MOD-005 y MOD-005-S01 están marcados,
 *   solo procesa MOD-005 (el hijo se elimina automáticamente con el padre)
 * - Bloquea eliminación de MOD-001 y MOD-099
 * 
 * @param {string} codigoCompleto - Código original completo
 * @param {Array} idsAEliminar - Array de IDs a eliminar (ej: ["MOD-003:", "MOD-005:"])
 * @param {boolean} reenumerar - Si true, reenumera después de eliminar
 * @return {Object} {success, codigo?, eliminados?, deduplicados?, error?}
 */
function eliminarModulos(codigoCompleto, idsAEliminar, reenumerar) {
  try {
    if (!codigoCompleto || !idsAEliminar || !Array.isArray(idsAEliminar)) {
      return {
        success: false,
        error: 'Parámetros inválidos'
      };
    }

    if (idsAEliminar.length === 0) {
      return {
        success: false,
        error: 'No se seleccionaron módulos para eliminar'
      };
    }

    // 🔹 PASO 1: Validar módulos críticos
    const criticos = idsAEliminar.filter(id => 
      id === 'MOD-001:' || id === 'MOD-099:'
    );
    
    if (criticos.length > 0) {
      return {
        success: false,
        error: `No se pueden eliminar módulos críticos: ${criticos.join(', ')}`
      };
    }

    // 🔹 PASO 2: Deduplicar (eliminar hijos si su padre está marcado)
    const idsLimpios = deduplicarModulos(idsAEliminar);
    const deduplicados = idsAEliminar.length - idsLimpios.length;

    Logger.log(`🗑️ MOD-019: Eliminando ${idsLimpios.length} módulo(s)`);
    if (deduplicados > 0) {
      Logger.log(`ℹ️ ${deduplicados} redundancia(s) ignorada(s)`);
    }

    // 🔹 PASO 3: Eliminar cada módulo (bloque completo)
    let codigoResultante = codigoCompleto;
    
    for (const id of idsLimpios) {
      const resultado = eliminarBloqueModulo(codigoResultante, id);
      
      if (!resultado.success) {
        return {
          success: false,
          error: `Error al eliminar ${id}: ${resultado.error}`
        };
      }
      
      codigoResultante = resultado.codigo;
      Logger.log(`  ✅ ${id} eliminado`);
    }

    // 🔹 PASO 4: Reenumerar si se solicitó
    if (reenumerar) {
      Logger.log('🔢 Reenumerando código...');
      const resultadoReenum = reenumerarModulosCompleto(codigoResultante);
      
      if (resultadoReenum.success && resultadoReenum.codigo) {
        codigoResultante = resultadoReenum.codigo;
        Logger.log('✅ Reenumeración completada');
      }
    }

    Logger.log(`✅ MOD-019: ${idsLimpios.length} módulo(s) eliminado(s) exitosamente`);

    return {
      success: true,
      codigo: codigoResultante,
      eliminados: idsLimpios.length,
      deduplicados: deduplicados
    };

  } catch (error) {
    Logger.log('❌ Error en MOD-019: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deduplicar módulos: elimina hijos si su padre está en la lista.
 * 
 * LÓGICA:
 * Si MOD-005 y MOD-005-S01 están marcados, solo mantiene MOD-005.
 * El hijo se eliminará automáticamente al eliminar el bloque del padre.
 * 
 * @param {Array} idsAEliminar - Array de IDs marcados
 * @return {Array} Array de IDs sin redundancias
 */
function deduplicarModulos(idsAEliminar) {
  const resultado = [];
  
  for (const id of idsAEliminar) {
    // Verificar si algún padre de este módulo está en la lista
    const tienePadreEnLista = idsAEliminar.some(otroId => {
      return esHijoDe(id, otroId);
    });
    
    // Solo agregar si NO tiene padre en la lista
    if (!tienePadreEnLista) {
      resultado.push(id);
    } else {
      Logger.log(`  ℹ️ ${id} ignorado (redundante con su padre)`);
    }
  }
  
  return resultado;
}

/**
 * Verifica si un ID es hijo de otro.
 * 
 * EJEMPLOS:
 * - esHijoDe("MOD-005-S01:", "MOD-005:") → true
 * - esHijoDe("MOD-005:", "MOD-005-S01:") → false
 * - esHijoDe("MOD-006:", "MOD-005:") → false
 * 
 * @param {string} posibleHijo - ID que podría ser hijo
 * @param {string} posiblePadre - ID que podría ser padre
 * @return {boolean} true si posibleHijo es hijo de posiblePadre
 */
function esHijoDe(posibleHijo, posiblePadre) {
  // El hijo debe tener -S
  if (!posibleHijo.includes('-S')) {
    return false;
  }
  
  // Extraer número base del padre
  // MOD-005: → 005
  const matchPadre = posiblePadre.match(/MOD-(\d{3}):/);
  if (!matchPadre) return false;
  
  const numeroPadre = matchPadre[1];
  
  // Extraer número base del posible hijo
  // MOD-005-S01: → 005
  const matchHijo = posibleHijo.match(/MOD-(\d{3})-S/);
  if (!matchHijo) return false;
  
  const numeroHijo = matchHijo[1];
  
  // Son padre-hijo si los números base coinciden
  return numeroPadre === numeroHijo;
}

/**
 * Elimina un bloque completo de módulo del código.
 * Busca las líneas [INICIO] y FIN, y elimina TODO entre ellas (inclusive).
 * 
 * @param {string} codigo - Código completo
 * @param {string} idModulo - ID del módulo a eliminar
 * @return {Object} {success, codigo?, error?}
 */
function eliminarBloqueModulo(codigo, idModulo) {
  try {
    const lineas = codigo.split('\n');
    let lineaInicio = -1;
    let lineaFin = -1;
    
    // 🔹 Buscar línea [INICIO]
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      if (linea.includes(idModulo) && linea.includes('[INICIO]')) {
        lineaInicio = i;
        break;
      }
    }
    
    if (lineaInicio === -1) {
      return {
        success: false,
        error: `No se encontró el delimitador [INICIO] de ${idModulo}`
      };
    }
    
    // 🔹 Buscar línea FIN (después de INICIO)
    for (let i = lineaInicio + 1; i < lineas.length; i++) {
      const linea = lineas[i];
      if (linea.includes(idModulo) && linea.includes('FIN')) {
        lineaFin = i;
        break;
      }
    }
    
    if (lineaFin === -1) {
      return {
        success: false,
        error: `No se encontró el delimitador FIN de ${idModulo}`
      };
    }
    
    // 🔹 Eliminar bloque completo (líneas desde lineaInicio hasta lineaFin, inclusive)
    lineas.splice(lineaInicio, lineaFin - lineaInicio + 1);
    
    // 🔹 Limpiar líneas en blanco excesivas (máximo 2 líneas en blanco consecutivas)
    const codigoLimpio = lineas.join('\n').replace(/\n{3,}/g, '\n\n');
    
    return {
      success: true,
      codigo: codigoLimpio
    };
    
  } catch (error) {
    Logger.log('❌ Error en eliminarBloqueModulo: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
// MOD-019: FIN

// MOD-099: NOTAS [INICIO]
/*
Backend central de CodeWorkShop.
Detecta, parsea, valida y reemplaza módulos con delimitadores MOD-XXX.

CARACTERÍSTICAS:
- Ultra agnóstico: soporta cualquier símbolo de comentario
- Soporta MODs y SubMODs jerárquicos (MOD-004-S01)
- Modo híbrido: reemplaza si existe, agrega si es nuevo con lógica antecesor/sucesor

FUNCIONES PRINCIPALES:
- parsearModulos() - Detección ultra agnóstica + conteo de líneas
- agregarModuloNuevo() V5 - Híbrido con inserción simple: busca antecesor → inserta después FIN, si no busca sucesor → inserta antes INICIO
- reemplazarModulo() - Reemplazo quirúrgico preservando formato
*/
// MOD-099: FIN
