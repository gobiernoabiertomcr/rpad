import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import readline from 'readline';
import { emailValido, validarContrasena } from '../services/usuariosReglas.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const setupAdmin = async () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🔐 Configuración de Usuario - RPAD                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Verificar si ya existe un admin
    const [existing] = await pool.execute(
      'SELECT COUNT(*) as count FROM usuarios'
    );

    if (existing[0].count > 0) {
      console.log('⚠️  Ya existe un usuario en el sistema.');
      const continuar = await question('¿Desea crear otro usuario? (s/n): ');
      
      if (continuar.toLowerCase() !== 's') {
        console.log('Operación cancelada.');
        process.exit(0);
      }
    }

    // Solicitar datos
    const username = await question('Nombre de usuario: ');
    const nombre_completo = await question('Nombre completo: ');
    const email = await question('Email: ');
    const password = await question('Contraseña (mínimo 8 caracteres): ');
    const rolInput = await question('Rol (superadmin/admin/editor/lector) [lector]: ');
    const rolElegido = rolInput.trim().toLowerCase();
    const rol = ['superadmin', 'admin', 'editor', 'lector'].includes(rolElegido) ? rolElegido : 'lector';

    if (!emailValido(email.trim().toLowerCase())) {
      console.error('❌ El email no es válido.');
      process.exit(1);
    }

    const errorContrasena = validarContrasena(password);
    if (errorContrasena) {
      console.error(`❌ ${errorContrasena}.`);
      process.exit(1);
    }

    // Hashear contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    await pool.execute(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) 
       VALUES (?, ?, ?, ?, ?)`,
      [username.trim(), password_hash, nombre_completo.trim(), email.trim().toLowerCase(), rol]
    );

    console.log('');
    console.log('✅ Usuario creado exitosamente!');
    console.log('');
    console.log('   Usuario:', username);
    console.log('   Email:', email);
    console.log('   Rol:', rol);
    console.log('');

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('❌ El usuario o email ya existe en el sistema.');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
    process.exit(0);
  }
};

setupAdmin();
