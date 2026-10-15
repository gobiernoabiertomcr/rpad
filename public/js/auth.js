// Módulo de autenticación
const Auth = {
  // Obtener token almacenado
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  // Obtener usuario almacenado
  getUser() {
    const user = localStorage.getItem(CONFIG.USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  // Obtener rol del usuario
  getRole() {
    const user = this.getUser();
    return user?.rol || null;
  },

  // Verificar si es administrador: admin y superadmin pasan todo lo de administración
  isAdmin() {
    return ['admin', 'superadmin'].includes(this.getRole());
  },

  // Verificar si es superadmin
  isSuperadmin() {
    return this.getRole() === 'superadmin';
  },

  // Rol para mostrar en el header
  getRoleText() {
    return { superadmin: 'Superadmin', admin: 'Administrador' }[this.getRole()] || 'Lector';
  },

  // Confirma la sesión con el servidor y actualiza el usuario guardado (rol, nombre, cargo).
  // Devuelve 'ok', 'invalida' (401: cuenta desactivada o contraseña cambiada) o 'sin-conexion'.
  async refrescarSesion() {
    const token = this.getToken();
    if (!token) return 'invalida';
    try {
      const response = await fetch(`${CONFIG.API_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) return 'invalida';
      if (!response.ok) return 'sin-conexion';
      const data = await response.json();
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify({ ...this.getUser(), ...data.data.user }));
      return 'ok';
    } catch {
      return 'sin-conexion';
    }
  },

  // Verificar si está autenticado
  isAuthenticated() {
    return !!this.getToken();
  },

  // Guardar sesión
  saveSession(token, user) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },

  // Cerrar sesión
  logout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    window.location.href = 'login.html';
  },

  // Login
  async login(username, password) {
    const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Error al iniciar sesión');
    }

    // El backend devuelve { success, data: { token, user } }
    this.saveSession(result.data.token, result.data.user);
    return result.data;
  },

  // Verificar sesión
  async verify() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${CONFIG.API_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Headers con autenticación
  getAuthHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },
  // Verificar si el token JWT expiró
  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      const now = Date.now() / 1000;
      return decoded.exp < now;
    } catch {
      return true;
    }
  },
  // Logout silencioso (sin redirección)
  clearSession() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  }
};
