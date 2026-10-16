// Mi Perfil (public/js/perfil.js), ejecutado en Node: los botones de aprobar y rechazar según quién puede auditar el
// cambio, y quién lo auditó (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const escaparHtml = (texto) => String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cargarPerfil = () => {
  const contexto = vm.createContext({
    document: { addEventListener() {}, getElementById: () => ({}) },
    Utils: { escapeHtml: escaparHtml }, Auth: {}, API: {}, CONFIG: {}, console
  });
  vm.runInContext(fs.readFileSync(new URL('../public/js/perfil.js', import.meta.url), 'utf8'), contexto);
  return contexto;
};
const MENSAJE = 'Este cambio lo auditan Persona Auditora. Podés auditarlo solo si ninguno está disponible.';

describe('perfil.js: auditar un cambio (spec 8.2)', () => {
  it('con permiso, los botones de aprobar y rechazar funcionan', () => {
    const html = cargarPerfil().botonesDeAuditoria(5, { puede: true, mensaje: null });
    assert.match(html, /onclick="aprobarCambio\(5\)"/);
    assert.match(html, /abrirModalRechazo\(5\)/);
    assert.doesNotMatch(html, /disabled/);
  });

  it('sin permiso aparecen deshabilitados, con el motivo', () => {
    const contexto = cargarPerfil();
    const html = contexto.botonesDeAuditoria(5, { puede: false, mensaje: MENSAJE });
    assert.equal(html.match(/disabled/g).length, 2);
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo/);
    assert.ok(html.includes(`title="${MENSAJE}"`));
    assert.ok(contexto.avisoNoCorresponde('<b>x</b>').includes('&lt;b&gt;x&lt;/b&gt;'));
  });

  it('quién auditó: aprobado o rechazado, con "(respaldo)" si fue un editor de respaldo', () => {
    const contexto = cargarPerfil();
    assert.equal(contexto.textoRevisor({ estado: 'aprobado', revisor_nombre: 'Persona Editora', revisado_como_respaldo: 1 }),
      'Aprobado por Persona Editora (respaldo)');
    assert.equal(contexto.textoRevisor({ estado: 'aprobado', revisor_nombre: 'Persona Auditora', revisado_como_respaldo: 0 }),
      'Aprobado por Persona Auditora');
    assert.equal(contexto.textoRevisor({ estado: 'rechazado', revisor_nombre: 'Persona Editora', revisado_como_respaldo: 1 }),
      'Rechazado por Persona Editora (respaldo)');
  });
});
