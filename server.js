const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// BITÁCORA EN MEMORIA: Guardará el historial de coordenadas del viaje activo
let historialRutaNorte = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/leaflet.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.js'));
});

app.get('/leaflet.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.css'));
});

io.on('connection', (socket) => {
    console.log(`📡 Nuevo dispositivo conectado: ${socket.id}`);

    // NUEVO: En cuanto un pasajero/supervisor conecta su pantalla, 
    // el servidor le envía de golpe todo el camino que el bus ya recorrió
    if (historialRutaNorte.length > 0) {
        socket.emit('cargar_historial_bitacora', historialRutaNorte);
    }

    socket.on('conductor_envia_coordenadas', (data) => {
        data.ultimaActualizacion = new Date().toLocaleTimeString();
        const margenPrecision = data.precision !== undefined ? data.precision : 'Desconocida';
        
        // Guardamos el punto actual en nuestra bitácora del servidor
        historialRutaNorte.push({
            lat: data.lat,
            lng: data.lng,
            velocidad: data.velocidad,
            precision: data.precision,
            ultimaActualizacion: data.ultimaActualizacion
        });

        // Limpieza de seguridad: Si la bitácora supera los 5,000 puntos (muchas horas de viaje), 
        // borramos el punto más antiguo para proteger la memoria del servidor
        if (historialRutaNorte.length > 5000) {
            historialRutaNorte.shift();
        }

        console.log(`🚗 [${data.rutaId}] Historial: ${historialRutaNorte.length} pts | Lat: ${data.lat} | Precisión: ${margenPrecision}m`);
        
        io.emit(`usuario_recibe_ruta_${data.rutaId}`, data);
    });

    // NUEVO: Evento para que el conductor pueda limpiar la bitácora al terminar su jornada
    socket.on('finalizar_viaje_limpiar_bitacora', () => {
        historialRutaNorte = [];
        console.log("🧹 Bitácora de viaje reseteada por el conductor.");
        io.emit('limpiar_mapa_pasajeros');
    });

    socket.on('disconnect', () => {
        console.log(`❌ Dispositivo desconectado: ${socket.id}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor con memoria de bitácora corriendo en el puerto ${PORT}`);
});
