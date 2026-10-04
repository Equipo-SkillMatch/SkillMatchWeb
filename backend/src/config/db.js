require('dotenv').config();

const { Pool, types } = require('pg');

// Evita que los campos DATE de PostgreSQL se conviertan a UTC y aparezcan un día antes en México.
types.setTypeParser(1082, (value) => value);

// Solo mostrar mensajes Informativos si NO estamos ejecutando pruebas con Jest
if (process.env.NODE_ENV !== 'test') {
  console.log('Configuración de BD cargada correctamente');
}

const useSsl = process.env.DB_SSL !== 'false';

// pg-connection-string interpreta "sslmode" en la URL y lo antepone al objeto `ssl`
// (con sslmode=require exige verificar la cadena de certificados), lo que rompe la
// conexión con proveedores como Aiven que usan un CA autofirmado. Se retira ese
// parámetro de la URL y el modo SSL se controla únicamente vía la opción `ssl`.
const connectionString = (process.env.DATABASE_URL || '').replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, '');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || ''),
      database: process.env.DB_NAME || 'skillmatch',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    });

const INSERT_RETURNING_COLUMNS = {
  usuarios: 'id_usuario',
  empresas: 'id_empresa',
  estudiantes: 'id_estudiante',
  profesores: 'id_profesor',
  proyectos: 'id_proyecto',
  evidencias: 'id_evidencia',
  horarios_profesores: 'id_horario',
  calificaciones: 'id_calificacion',
  cvs: 'id_cv',
  auditoria: 'id_evento',
  chatbot: 'id_pregunta',
  carreras: 'id_carrera',
  vacantes: 'id_vacante',
  postulaciones: 'id_postulacion',
  proyecto_media: 'id_media',
  soft_skills_preguntas: 'id_pregunta',
  soft_skills_resultados: 'id_resultado',
  periodos_estadia: 'id_periodo',
  guias_estadia: 'id_guia',
  rubricas_estadia: 'id_rubrica',
  rubrica_criterios_estadia: 'id_criterio',
  talleres_estadia: 'id_taller',
  grupos_estadia: 'id_grupo',
  fechas_avances_estadia: 'id_fecha_avance',
  estadias: 'id_estadia',
  expedientes_estadia: 'id_expediente',
  seguros_facultativos: 'id_seguro',
  entregas_avances_estadia: 'id_entrega',
  revisiones_avances_estadia: 'id_revision',
  grupos_escolares: 'id_grupo_escolar',
};

function normalizePostgresError(error) {
  if (!error) return error;

  const mysqlLikeCodes = {
    '23505': 'ER_DUP_ENTRY',
    '42P01': 'ER_NO_SUCH_TABLE',
    '42703': 'ER_BAD_FIELD_ERROR',
  };

  if (mysqlLikeCodes[error.code]) {
    error.mysqlCode = mysqlLikeCodes[error.code];
  }

  return error;
}

function addReturningIfNeeded(sql) {
  const cleanedSql = sql.trim().replace(/;\s*$/, '');

  if (/\bRETURNING\b/i.test(cleanedSql)) {
    return cleanedSql;
  }

  const match = cleanedSql.match(/^\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (!match) {
    return cleanedSql;
  }

  const table = match[1].toLowerCase();
  const returningColumn = INSERT_RETURNING_COLUMNS[table];

  if (!returningColumn) {
    return cleanedSql;
  }

  return `${cleanedSql} RETURNING ${returningColumn}`;
}

function convertMysqlPlaceholders(sql, params = []) {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let result = '';

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const previous = sql[i - 1];

    if (char === "'" && !inDouble && previous !== '\\') {
      inSingle = !inSingle;
      result += char;
      continue;
    }

    if (char === '"' && !inSingle && previous !== '\\') {
      inDouble = !inDouble;
      result += char;
      continue;
    }

    if (char === '?' && !inSingle && !inDouble) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  if (index !== params.length) {
    return { text: result, values: params };
  }

  return { text: result, values: params };
}

function normalizeSql(sql) {
  return addReturningIfNeeded(
    sql
      .replace(/`/g, '')
      .replace(/\bIFNULL\s*\(/gi, 'COALESCE(')
      .replace(/\bCURDATE\s*\(\s*\)/gi, 'CURRENT_DATE')
  );
}

function getInsertId(rows = []) {
  if (!rows.length) return null;

  const firstRow = rows[0];
  const idKey = Object.keys(firstRow).find((key) => /^id_/i.test(key)) || Object.keys(firstRow)[0];

  return firstRow[idKey] ?? null;
}

function isSelectCommand(command) {
  return ['SELECT', 'SHOW', 'WITH'].includes(String(command || '').toUpperCase());
}

async function runQuery(client, sql, params = []) {
  const normalizedSql = normalizeSql(sql);
  const { text, values } = convertMysqlPlaceholders(normalizedSql, params);

  try {
    const result = await client.query(text, values);

    if (isSelectCommand(result.command)) {
      return [result.rows, result.fields];
    }

    const meta = {
      affectedRows: result.rowCount || 0,
      rowCount: result.rowCount || 0,
      insertId: getInsertId(result.rows),
      rows: result.rows,
      command: result.command,
    };

    return [meta, result.fields];
  } catch (error) {
    throw normalizePostgresError(error);
  }
}

async function query(sql, params = []) {
  return runQuery(pool, sql, params);
}

async function getConnection() {
  const client = await pool.connect();

  return {
    query: (sql, params = []) => runQuery(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

// Omitir la comprobación asíncrona de conexión durante los tests automáticos
if (process.env.NODE_ENV !== 'test') {
  pool
    .query('SELECT 1')
    .then(() => console.log('Conectado a PostgreSQL'))
    .catch((error) => console.error('Error de conexión a PostgreSQL:', error.message));
}

module.exports = {
  query,
  getConnection,
  pool,
};