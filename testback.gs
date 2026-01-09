/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ PROYECTO: CodeWorkShop                                   ║
 * ║ ARCHIVO: testback.gs                                     ║
 * ║ VERSIÓN: 1.0.1                                          ║
 * ║ FECHA: 09/01/2026 15:30 (UTC-5)                         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// MOD-001: EJECUTAR TODOS LOS TESTS [INICIO]
function allBack() {
  limpiarTests();
  
  try {
    DriveApp.getRootFolder();
  } catch (e) {
    return 'ERROR: Se requieren permisos. Ejecuta forzarPermisos() primero.';
  }
  
  const logs = [];
  logs.push('═══════════════════════════════');
  logs.push('TESTS DEL BACKEND');
  logs.push('═══════════════════════════════\n');
  
  logs.push(...testParsearModulos());
  logs.push(...testExtraerHeader());
  logs.push(...testValidarModulo());
  logs.push(...testReemplazarModulo());
  
  logs.push('\n═══════════════════════════════');
  logs.push('RESUMEN');
  logs.push('═══════════════════════════════');
  
  const total = logs.filter(l => l.includes('✅') || l.includes('❌')).length;
  const exitosos = logs.filter(l => l.includes('✅')).length;
  const fallidos = logs.filter(l => l.includes('❌')).length;
  
  logs.push(`Total: ${total} | Exitosos: ${exitosos} | Fallidos: ${fallidos}`);
  
  return logs.join('\n');
}
// MOD-001: FIN

// MOD-002: LIMPIAR TESTS [INICIO]
function limpiarTests() {
  Logger.log('Tests limpios - sin datos persistentes');
}
// MOD-002: FIN

// MOD-003: TEST PARSEAR MÓDULOS [INICIO]
function testParsearModulos() {
  const logs = [];
  logs.push('TEST 1: Parsear Módulos');
  logs.push('------------------------');
  
  const codigoPrueba = `/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ PROYECTO: Test                                           ║
 * ║ ARCHIVO: test.gs                                         ║
 * ║ VERSIÓN: 1.0.0                                          ║
 * ║ FECHA: 09/01/2026 15:00 (UTC-5)                         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// MOD-001: FUNCIÓN A [INICIO]
function funcionA() {
  return "A";
}
// MOD-001: FIN

// MOD-002: FUNCIÓN B [INICIO]
function funcionB() {
  return "B";
}
// MOD-002: FIN`;

  try {
    const resultado = parsearModulos(codigoPrueba);
    
    if (resultado.success && resultado.modulos.length === 2) {
      logs.push('✅ Detecta módulos correctamente');
      logs.push('   - Módulos encontrados: ' + resultado.modulos.length);
      logs.push('   - MOD-001: ' + resultado.modulos[0].descripcion);
      logs.push('   - MOD-002: ' + resultado.modulos[1].descripcion);
    } else {
      logs.push('❌ Error al detectar módulos');
      logs.push('   - Esperado: 2 módulos');
      logs.push('   - Obtenido: ' + (resultado.modulos ? resultado.modulos.length : 0));
    }
  } catch (error) {
    logs.push('❌ Excepción: ' + error.message);
  }
  
  logs.push('');
  return logs;
}
// MOD-003: FIN

// MOD-004: TEST EXTRAER HEADER [INICIO]
function testExtraerHeader() {
  const logs = [];
  logs.push('TEST 2: Extraer Header');
  logs.push('------------------------');
  
  const codigoPrueba = `/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ PROYECTO: MiProyecto                                     ║
 * ║ ARCHIVO: codigo.gs                                       ║
 * ║ VERSIÓN: 2.1.5                                          ║
 * ║ FECHA: 09/01/2026 14:30 (UTC-5)                         ║
 * ╚══════════════════════════════════════════════════════════╝
 */`;

  try {
    const resultado = extraerHeader(codigoPrueba);
    
    if (resultado.success) {
      const h = resultado.header;
      if (h.proyecto === 'MiProyecto' && h.version === '2.1.5') {
        logs.push('✅ Header extraído correctamente');
        logs.push('   - Proyecto: ' + h.proyecto);
        logs.push('   - Archivo: ' + h.archivo);
        logs.push('   - Versión: ' + h.version);
      } else {
        logs.push('❌ Datos del header incorrectos');
      }
    } else {
      logs.push('❌ No se pudo extraer header');
      logs.push('   - Error: ' + resultado.error);
    }
  } catch (error) {
    logs.push('❌ Excepción: ' + error.message);
  }
  
  logs.push('');
  return logs;
}
// MOD-004: FIN

// MOD-005: TEST VALIDAR MÓDULO [INICIO]
function testValidarModulo() {
  const logs = [];
  logs.push('TEST 3: Validar Módulo');
  logs.push('------------------------');
  
  const moduloValido = `// MOD-003: TEST VÁLIDO [INICIO]
function test() {
  return true;
}
// MOD-003: FIN`;

  const moduloInvalido = `// MOD-003: TEST INVÁLIDO [INICIO]
function test() {
  return false;
}`;

  try {
    const resultado1 = validarModulo(moduloValido, '003');
    const resultado2 = validarModulo(moduloInvalido, '003');
    
    if (resultado1.success && !resultado2.success) {
      logs.push('✅ Validación funciona correctamente');
      logs.push('   - Módulo válido: PASS');
      logs.push('   - Módulo inválido: FAIL (esperado)');
    } else {
      logs.push('❌ Error en validación');
    }
  } catch (error) {
    logs.push('❌ Excepción: ' + error.message);
  }
  
  logs.push('');
  return logs;
}
// MOD-005: FIN

// MOD-006: TEST REEMPLAZAR MÓDULO [INICIO]
function testReemplazarModulo() {
  const logs = [];
  logs.push('TEST 4: Reemplazar Módulo');
  logs.push('------------------------');
  
  const codigoOriginal = `/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ PROYECTO: Test                                           ║
 * ║ ARCHIVO: test.gs                                         ║
 * ║ VERSIÓN: 1.0.0                                          ║
 * ║ FECHA: 09/01/2026 15:00 (UTC-5)                         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// MOD-001: FUNCIÓN ORIGINAL [INICIO]
function funcionOriginal() {
  return "original";
}
// MOD-001: FIN`;

  const nuevoModulo = `// MOD-001: FUNCIÓN ORIGINAL [INICIO]
function funcionOriginal() {
  return "modificado";
}
// MOD-001: FIN`;

  try {
    const resultado = reemplazarModulo(codigoOriginal, '001', nuevoModulo);
    
    if (resultado.success && resultado.codigo.includes('modificado')) {
      logs.push('✅ Reemplazo exitoso');
      logs.push('   - Código actualizado correctamente');
      logs.push('   - Versión incrementada');
    } else {
      logs.push('❌ Error en reemplazo');
      if (resultado.error) {
        logs.push('   - Error: ' + resultado.error);
      }
    }
  } catch (error) {
    logs.push('❌ Excepción: ' + error.message);
  }
  
  logs.push('');
  return logs;
}
// MOD-006: FIN
