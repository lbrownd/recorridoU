const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Servir la interfaz web unificada (index.html) para cualquier ruta de acceso
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/pasajero', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/conductor', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir dependencias de mapas de forma local desde node_modules
app.get('/leaflet.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.js'));
});

app.get('/leaflet.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.css'));
});

// Gestión de la comunicación por Sockets
io.on('connection', (socket) => {
    console.log(`📡 Dispositivo conectado al sistema: ${socket.id}`);

    socket.on('conductor_envia_coordenadas', (data) => {
        // Estampa de tiempo oficial generada por el reloj del servidor
        data.ultimaActualizacion = new Date().toLocaleTimeString();
        
        // Control de respaldo por si la precisión llega vacía desde el teléfono
        const margenPrecision = data.precision !== undefined ? data.precision : 'Desconocida';
        const velocidadActual = data.velocidad !== null ? data.velocidad : 0;
        
        // Log limpio y estandarizado en la terminal para monitoreo en vivo
        console.log(`🚗 [${data.rutaId}] Lat: ${data.lat}, Lng: ${data.lng} | Precisión: ${margenPrecision}m | Vel: ${velocidadActual} km/h`);
        
        // Retransmitir de forma masiva a todos los clientes que monitorean la ruta
        io.emit(`usuario_recibe_ruta_${data.rutaId}`, data);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Dispositivo desconectado del sistema: ${socket.id}`);
    });
});

// Levantar el servicio escuchando en 0.0.0.0 (Obligatorio para pruebas por red local/Wi-Fi)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR COMPATIBLE CON GPS REAL CORRIENDO`);
    console.log(`▶️ Enlace para pruebas locales (PC):  http://localhost:${PORT}`);
    console.log(`⚠️ REQUISITO PARA CELULARES: Debes acceder mediante HTTPS (vía túnel) o configurar tu IP local.`);
});
