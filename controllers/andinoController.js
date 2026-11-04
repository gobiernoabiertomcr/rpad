// Controller para integración con API de Andino (Portal de Datos Abiertos)

// Vale para toda la respuesta: también si el portal contesta los encabezados y no termina el cuerpo
const TIEMPO_LIMITE_DEL_PORTAL = 10000;

/**
 * Mapa de normalización de formatos de Andino a RPAD
 * Andino devuelve formatos en MAYÚSCULAS
 */
const FORMATO_NORMALIZACION = {
  'MD': 'Markdown',
  'TXT': 'Texto plano'
};

/**
 * Normaliza un formato de Andino al catálogo RPAD
 * @param {string} formato - Formato tal como viene de Andino (en mayúsculas)
 * @returns {string} - Formato normalizado para RPAD
 */
function normalizarFormato(formato) {
  const upper = formato.toUpperCase().trim();
  return FORMATO_NORMALIZACION[upper] || upper;
}

/**
 * Extrae el slug del dataset desde una URL del portal
 * @param {string} url - URL completa del dataset
 * @returns {string|null} - Slug del dataset o null si no es válida
 */
function extractSlugFromUrl(url) {
  if (!url) return null;
  
  // Patrones válidos:
  // https://datos.comodoro.gov.ar/dataset/nombre-del-dataset
  // http://datos.comodoro.gov.ar/dataset/nombre-del-dataset
  // datos.comodoro.gov.ar/dataset/nombre-del-dataset
  
  const patterns = [
    /datos\.comodoro\.gov\.ar\/dataset\/([a-z0-9-]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Consulta la API de Andino y devuelve los datos mapeados
 */
export const fetchFromAndino = async (req, res) => {
  try {
    const { url } = req.query;

    // req.query también puede traer una lista o un objeto
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el parámetro url'
      });
    }

    // Extraer slug de la URL
    const slug = extractSlugFromUrl(url);
    
    if (!slug) {
      return res.status(400).json({
        success: false,
        error: 'URL no válida. Debe ser una URL del portal datos.comodoro.gov.ar/dataset/...'
      });
    }

    // Consultar API de Andino
    const apiUrl = `https://datos.comodoro.gov.ar/api/3/action/package_show?id=${slug}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RPAD-MCR/1.4.0'
      },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_DEL_PORTAL)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Dataset no encontrado en el portal de datos abiertos'
        });
      }
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.result) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró información del dataset'
      });
    }

    const dataset = data.result;

    // Extraer formatos únicos de los recursos
    const formatosSet = new Set();

    if (dataset.resources && Array.isArray(dataset.resources)) {
      dataset.resources.forEach(resource => {
        if (resource.format) {
          const formatoRaw = resource.format.toUpperCase().trim();
          
          // Caso especial: ZIP que contiene shapefile
          if (formatoRaw === 'ZIP' && resource.name && 
              resource.name.toLowerCase().includes('shapefile')) {
            formatosSet.add('SHP');
          } else {
            // Normalizar formato
            formatosSet.add(normalizarFormato(formatoRaw));
          }
        }
      });
    }

    const formatosArray = Array.from(formatosSet);

    // Mapear campos de Andino a RPAD
    // area_responsable_texto es solo referencia, no se usa directamente
    const mappedData = {
      titulo: dataset.title || '',
      descripcion: dataset.notes || '',
      area_responsable_texto: dataset.author || '', // Solo como referencia para el usuario
      url_dataset: url.trim(),
      formatos: formatosArray  // Array de nombres de formatos normalizados
    };

    res.json({
      success: true,
      data: mappedData,
      source: {
        slug: slug,
        api_url: apiUrl
      }
    });

  } catch (error) {
    console.error('Error consultando API de Andino:', error);

    if (error.name === 'TimeoutError') {
      return res.status(504).json({
        success: false,
        error: 'El portal de datos abiertos no respondió a tiempo. Probá de nuevo en unos minutos.'
      });
    }

    // Errores de red
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      return res.status(503).json({
        success: false,
        error: 'No se pudo conectar con el portal de datos abiertos. Verifique su conexión o intente más tarde.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al consultar el portal de datos abiertos'
    });
  }
};
