let socket = null, watchId = null, map = null, marcadorVehiculo = null, lineaTrayectoria = null, marcadorSalida = null, esPrimerPunto = true;
const PIN_AUTORIZADO = "1234", rutaId = "Ruta_Norte";
let accionPendiente = "", latInicial = 12.1364, lngInicial = -86.2514;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof io !== 'undefined') socket = io();
    if (typeof L !== 'undefined') {
        try {
            map = L.map('mapa').setView([latInicial, lngInicial], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

            // CORRECCIÓN: Dimensiones explícitas y fijas para el Autobús
            const iconoBus = L.divIcon({
                html: '<div style="font-size: 32px; line-height:1; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚌</div>',
                iconSize:,
                iconAnchor:,
                popupAnchor: [0, -15],
                className: 'marcador-bus-personalizado'
            });

            marcadorVehiculo = L.marker([latInicial, lngInicial], { icon: iconoBus }).addTo(map).bindPopup("<b>Transporte</b>").openPopup();
            lineaTrayectoria = L.polyline([], { color: '#2563eb', weight: 6, opacity: 0.85, lineJoin: 'round' }).addTo(map);
            setTimeout(() => { map.invalidateSize(); }, 300);
        } catch (e) { console.error(e); }
    }

    if (socket) {
        socket.on('cargar_historial_bitacora', (points) => {
            if (points.length > 0 && esPrimerPunto) {
                esPrimerPunto = false;
                const pIn = [parseFloat(points[0].lat), parseFloat(points[0].lng)];
                marcadorSalida = L.circleMarker(pIn, { radius: 8, fillColor: "#10b981", color: "#ffffff", weight: 2, fillOpacity: 1 }).addTo(map);
                const lista = points.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
                lineaTrayectoria.setLatLngs(lista);
                marcadorVehiculo.setLatLng(lista[lista.length - 1]);
                map.setView(lista[lista.length - 1], 16);
            }
        });

        socket.on('limpiar_mapa_pasajeros', () => {
            esPrimerPunto = true;
            if (lineaTrayectoria) lineaTrayectoria.setLatLngs([]);
            if (marcadorSalida) { map.removeLayer(marcadorSalida); marcadorSalida = null; }
            document.getElementById('coordenadas-recibidas').innerHTML = "Esperando señal de ubicación real...";
            if (map) map.setView([latInicial, lngInicial], 14);
        });

        socket.on(`usuario_recibe_ruta_${rutaId}`, (data) => {
            const hora = data.ultimaActualizacion || new Date().toLocaleTimeString();
            const pos = [parseFloat(data.lat), parseFloat(data.lng)];

            if (esPrimerPunto) {
                esPrimerPunto = false;
                marcadorSalida = L.circleMarker(pos, { radius: 8, fillColor: "#10b981", color: "#ffffff", weight: 2, fillOpacity: 1 }).addTo(map);
                map.setView(pos, 16);
            }
            
            document.getElementById('coordenadas-recibidas').innerHTML = `
                📌 <b>Ubicación Real Recibida:</b><br>
                Latitud: ${pos[0].toFixed(6)} | Longitud: ${pos[1].toFixed(6)}<br>
                Velocidad: ${data.velocidad || 0} km/h<br>
                <small style="color: #64748b;">Margen de error GPS: ±${data.precision}m</small><br>
                <small style="color:#2563eb; font-weight:bold;">🕒 Actualizado: ${hora}</small>
            `;
            
            if (map) {
                if (marcadorVehiculo) marcadorVehiculo.setLatLng(pos);
                if (lineaTrayectoria) lineaTrayectoria.addLatLng(pos);
                map.panTo(pos);
            }
        });
    }
});

function procesarYEnviarGps(position) {
    const status = document.getElementById('envio-status'), chk = document.getElementById('chk-precision');
    const lat = position.coords.latitude, lng = position.coords.longitude, acc = Math.round(position.coords.accuracy);
    let vel = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0;

    if (acc > 45) {
        status.innerText = "Señal débil, buscando precisión...";
        status.style.color = "#eab308";
        return;
    }

    status.innerText = "Estado: Transmitiendo EN VIVO 🛰️";
    status.style.color = "#2e7d32";
    chk.innerText = `${acc} metros`;

    if (socket) socket.emit('conductor_envia_coordenadas', { rutaId: rutaId, lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)), velocidad: vel, precision: acc });
}

function solicitarPinApagado(tipo) {
    if (watchId === null && tipo === 'pausa') { arrancarGpsFisico(); return; }
    accionPendiente = tipo;
    // CORRECCIÓN: Sintaxis de CSS limpia para desplegar el teclado
    document.getElementById('contenedor-pin').style.display = 'block';
    document.getElementById('input-pin').value = '';
    document.getElementById('input-pin').focus();
}

function validarPinConfirmacion() {
    if (document.getElementById('input-pin').value === PIN_AUTORIZADO) {
        // CORRECCIÓN: Sintaxis de CSS limpia para ocultar el teclado
        document.getElementById('contenedor-pin').style.display = 'none';
        if (accionPendiente === 'pausa') apagarGpsFisico();
        else if (accionPendiente === 'finalizar') ejecutarCierreJornada();
    } else {
        alert("❌ PIN Incorrecto. Intento de sabotaje detectado.");
        cancelarApagado();
    }
}

function cancelarApagado() { document.getElementById('contenedor-pin').style.display = 'none'; accionPendiente = ""; }

function arrancarGpsFisico() {
    const btn = document.getElementById('btn-viaje'), btnFin = document.getElementById('btn-finalizar'), status = document.getElementById('envio-status'), diag = document.getElementById('diagnostico-chofer');
    btn.innerText = "Pausar Transmisión"; btn.style.backgroundColor = "#d97706";
    btnFin.removeAttribute('disabled'); btnFin.style.cursor = 'pointer'; btnFin.style.backgroundColor = '#c62828';
    status.innerText = "Conectando satélites..."; status.style.color = "#eab308"; diag.style.display = "block";

    const opt = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition((p) => {
        procesarYEnviarGps(p);
        watchId = navigator.geolocation.watchPosition(procesarYEnviarGps, (e) => console.error(e), opt);
    }, (e) => { status.innerText = `Error de conexión GPS.`; status.style.color = "#c62828"; apagarGpsFisico(); }, opt);
}

function apagarGpsFisico() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    document.getElementById('btn-viaje').innerText = "Activar Mi GPS Real";
    document.getElementById('btn-viaje').style.backgroundColor = "#2e7d32";
    document.getElementById('envio-status').innerText = "Estado: GPS Apagado";
    document.getElementById('envio-status').style.color = "#000";
    document.getElementById('diagnostico-chofer').style.display = "none";
}

function ejecutarCierreJornada() {
    apagarGpsFisico();
    const btnFin = document.getElementById('btn-finalizar');
    btnFin.setAttribute('disabled', 'true'); btnFin.style.cursor = 'not-allowed'; btnFin.style.backgroundColor = '#9ca3af';
    esPrimerPunto = true;
    if(lineaTrayectoria) lineaTrayectoria.setLatLngs([]);
    if(marcadorSalida) { map.removeLayer(marcadorSalida); marcadorSalida = null; }
    if (socket) socket.emit('finalizar_viaje_limpiar_bitacora');
}
