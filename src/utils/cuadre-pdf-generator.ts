/**
 * Generador de Cuadre Diario en PDF - Centro de Diagnóstico Conrad
 * Reutiliza los mismos datos que el generador de Excel (CuadreDatos) para que
 * ambos formatos siempre queden consistentes entre sí.
 * Sigue el mismo patrón que src/lib/recibos.ts: genera HTML estilizado y lo
 * abre en una ventana para imprimir / "Guardar como PDF" desde el navegador.
 */
import type { CuadreDatos } from './cuadre-excel-generator';

const fmt = (n: number) => `Q${(n || 0).toFixed(2)}`;

const nombreFormaPago = (forma: string) => {
  const formas: { [key: string]: string } = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    efectivo_facturado: 'Depósito',
    estado_cuenta: 'Estado de Cuenta',
    multiple: 'Múltiple',
  };
  return formas[forma] || forma;
};

export const generarCuadrePDF = (datos: CuadreDatos): string => {
  const totalGastos = (datos.gastos || []).reduce((s, g) => s + (g.monto || 0), 0);

  const filasDetalleMoviles = () => {
    const filas = datos.cuadresPorFormaPago.filter(c => !!c.es_servicio_movil);
    if (filas.length === 0) return '';
    const totalCantidad = filas.reduce((s, c) => s + c.cantidad, 0);
    const totalMonto = filas.reduce((s, c) => s + c.total, 0);
    return `
      <table class="tabla">
        <thead><tr><th>Forma de Pago</th><th class="num">Cantidad</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${filas.map(c => `<tr><td>${nombreFormaPago(c.forma_pago)}</td><td class="num">${c.cantidad}</td><td class="num">${fmt(c.total)}</td></tr>`).join('')}
          <tr class="fila-total"><td>Total Móviles</td><td class="num">${totalCantidad}</td><td class="num">${fmt(totalMonto)}</td></tr>
        </tbody>
      </table>
    `;
  };

  const seccionGastos = (datos.gastos && datos.gastos.length > 0) ? `
    <div class="seccion">
      <h2>Gastos del Día</h2>
      <table class="tabla">
        <thead><tr><th>Concepto</th><th>Categoría</th><th>Hora</th><th class="num">Monto</th></tr></thead>
        <tbody>
          ${datos.gastos.map(g => `
            <tr>
              <td>${g.concepto || '—'}</td>
              <td>${g.categoria || '—'}</td>
              <td>${g.created_at ? new Date(g.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td class="num">${fmt(g.monto)}</td>
            </tr>
          `).join('')}
          <tr class="fila-total"><td colspan="3">Total Gastos</td><td class="num">${fmt(totalGastos)}</td></tr>
        </tbody>
      </table>
    </div>
  ` : '';

  const filaCuadre = (label: string, esperado: number, contado: number, diferencia: number) => `
    <tr>
      <td>${label}</td>
      <td class="num">${fmt(esperado)}</td>
      <td class="num">${fmt(contado)}</td>
      <td class="num ${Math.abs(diferencia) >= 0.01 ? 'diferencia-mal' : 'diferencia-ok'}">${fmt(diferencia)}</td>
      <td class="num">${Math.abs(diferencia) < 0.01 ? '<span class="badge-ok">OK</span>' : '<span class="badge-mal">Revisar</span>'}</td>
    </tr>
  `;

  const filasCuadrePago = [
    filaCuadre('Efectivo', datos.efectivoEsperado, datos.efectivoContado, datos.diferencias.efectivo),
    filaCuadre('Tarjeta', datos.tarjetaEsperada, datos.tarjetaContado, datos.diferencias.tarjeta),
    filaCuadre('Transferencia/Depósito', datos.transferenciaEsperada, datos.transferenciaContado, datos.diferencias.depositado),
  ];
  if ((datos.estadoCuentaEsperada || 0) > 0) {
    filasCuadrePago.push(filaCuadre('Estado de Cuenta', datos.estadoCuentaEsperada || 0, datos.estadoCuentaContado || 0, datos.diferencias.estado_cuenta || 0));
  }

  const totalEsperado = datos.efectivoEsperado + datos.tarjetaEsperada + datos.transferenciaEsperada + (datos.estadoCuentaEsperada || 0);
  const totalContado = datos.efectivoContado + datos.tarjetaContado + datos.transferenciaContado + (datos.estadoCuentaContado || 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Cuadre Diario - Centro de Diagnóstico Conrad</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #e2e8f0; }
        body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11pt; padding: 24px 0; }
        .pagina {
          max-width: 210mm; margin: 0 auto; background: #fff;
          padding: 16mm 14mm; box-shadow: 0 0 0 1px rgba(15,23,42,0.06), 0 8px 30px rgba(15,23,42,0.12);
        }
        .encabezado {
          display: flex; justify-content: space-between; align-items: center;
          background: linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #0d9488 100%);
          color: #fff; padding: 16px 20px; border-radius: 10px; margin-bottom: 18px;
        }
        .marca { display: flex; align-items: center; gap: 12px; }
        .logo { width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .marca h1 { font-size: 15pt; font-weight: 800; letter-spacing: 0.3px; }
        .marca p { font-size: 9pt; color: #99f6e4; margin-top: 2px; }
        .meta { text-align: right; font-size: 9pt; color: #cbd5e1; line-height: 1.5; }
        .meta strong { color: #fff; }
        .titulo-reporte { text-align: center; font-size: 13pt; font-weight: 800; color: #0f172a; margin-bottom: 16px; letter-spacing: 0.5px; }

        .seccion { margin-bottom: 18px; }
        h2 { font-size: 11pt; font-weight: 800; color: #0f172a; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #0d9488; }

        .resumen-grid { display: flex; gap: 12px; margin-bottom: 18px; }
        .stat { flex: 1; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 12px 14px; }
        .stat .label { font-size: 8.5pt; color: #0f766e; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
        .stat .valor { font-size: 15pt; font-weight: 800; color: #0f172a; margin-top: 2px; }

        table.tabla { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        table.tabla th { background: #0f766e; color: #fff; text-align: left; padding: 7px 10px; font-weight: 700; }
        table.tabla td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        table.tabla .num { text-align: right; }
        table.tabla tr.fila-total { background: #f0fdfa; font-weight: 800; }
        table.tabla tr.fila-total td { border-top: 2px solid #0d9488; border-bottom: none; }

        .diferencia-ok { color: #059669; font-weight: 700; }
        .diferencia-mal { color: #dc2626; font-weight: 700; }
        .badge-ok { background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 999px; font-size: 8.5pt; font-weight: 800; }
        .badge-mal { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 999px; font-size: 8.5pt; font-weight: 800; }

        .banner-estado { text-align: center; padding: 10px; border-radius: 8px; font-weight: 800; font-size: 10.5pt; margin-top: 10px; }
        .banner-ok { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .banner-mal { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

        .observaciones { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: 9.5pt; color: #92400e; }

        .pie { margin-top: 24px; text-align: center; font-size: 8.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        .acciones { text-align: center; margin-top: 16px; }
        .acciones button { padding: 9px 20px; border: none; border-radius: 8px; font-size: 10pt; font-weight: 700; cursor: pointer; margin: 0 5px; }
        .btn-imprimir { background: #0d9488; color: #fff; }
        .btn-cerrar { background: #64748b; color: #fff; }
        @media print {
          .acciones { display: none; }
          html, body { background: #fff; padding: 0; }
          .pagina { max-width: none; margin: 0; padding: 0; box-shadow: none; }
          body { font-size: 10pt; }
        }
      </style>
    </head>
    <body>
      <div class="pagina">
      <div class="encabezado">
        <div class="marca">
          <div class="logo">✚</div>
          <div>
            <h1>CENTRO DE DIAGNÓSTICO CONRAD</h1>
            <p>Cuadre Diario de Caja</p>
          </div>
        </div>
        <div class="meta">
          <div>Fecha: <strong>${datos.fecha}</strong></div>
          <div>Hora: <strong>${datos.horaActual}</strong></div>
          ${datos.cajero ? `<div>Cajero: <strong>${datos.cajero}</strong></div>` : ''}
        </div>
      </div>

      <div class="resumen-grid">
        <div class="stat"><div class="label">Total Consultas</div><div class="valor">${datos.totalConsultas}</div></div>
        <div class="stat"><div class="label">Total Ventas</div><div class="valor">${fmt(datos.totalVentas)}</div></div>
        <div class="stat"><div class="label">Total Gastos</div><div class="valor">${fmt(totalGastos)}</div></div>
      </div>

      <div class="seccion">
        <h2>Cuadre por Forma de Pago</h2>
        <table class="tabla">
          <thead><tr><th>Forma de Pago</th><th class="num">Esperado</th><th class="num">Contado</th><th class="num">Diferencia</th><th class="num">Estado</th></tr></thead>
          <tbody>
            ${filasCuadrePago.join('')}
            <tr class="fila-total"><td>Total</td><td class="num">${fmt(totalEsperado)}</td><td class="num">${fmt(totalContado)}</td><td class="num" colspan="2"></td></tr>
          </tbody>
        </table>
        <div class="banner-estado ${datos.cuadreCorrecto ? 'banner-ok' : 'banner-mal'}">
          ${datos.cuadreCorrecto ? '✓ Cuadre Correcto' : '⚠ Se encontraron diferencias — revisar'}
        </div>
      </div>

      ${datos.cuadresPorFormaPago.some(c => c.es_servicio_movil) ? `
        <div class="seccion">
          <h2>Servicios Móviles — Detalle por Forma de Pago</h2>
          ${filasDetalleMoviles()}
        </div>
      ` : ''}

      ${seccionGastos}

      ${datos.observaciones ? `
        <div class="seccion">
          <h2>Observaciones</h2>
          <div class="observaciones">${datos.observaciones}</div>
        </div>
      ` : ''}

      <div class="pie">Reporte generado por Centro de Diagnóstico Conrad · ${datos.fecha} ${datos.horaActual}</div>
      </div>

      <div class="acciones">
        <button class="btn-imprimir" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
        <button class="btn-cerrar" onclick="window.close()">Cerrar</button>
      </div>
    </body>
    </html>
  `;
};

export const abrirCuadrePDF = (datos: CuadreDatos) => {
  const html = generarCuadrePDF(datos);
  const ventana = window.open('', 'CuadreDiarioPDF', 'height=900,width=850');
  if (ventana) {
    ventana.document.write(html);
    ventana.document.close();
  } else {
    alert('Por favor permita ventanas emergentes para generar el PDF');
  }
};
