document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHAR_WRITE_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
    const CHAR_NOTIFY_UUID = "498c599b-ad01-4148-8a6a-73c332854747";

    let bleDevice, bleServer, writeChar, notifyChar;
    let bleBuffer = ""; // Buffers incoming data to handle packet fragmentation

    let state = {
        boards: {}, // Stores: { 0: { name: 'Master', channels: { 1: 'disarmed', ... } } }
        selectedBoardId: 0
    };

    // --- DOM Elements ---
    const connectBtn = document.getElementById('connect-button');
    const refreshBtn = document.getElementById('refresh-button');
    const boardList = document.getElementById('board-list');
    const channelGrid = document.getElementById('channel-grid');
    const boardTitle = document.getElementById('board-title');

    // --- Connection Logic ---
    async function connect() {
        try {
            bleDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SERVICE_UUID] }]
            });
            bleServer = await bleDevice.gatt.connect();
            const service = await bleServer.getPrimaryService(SERVICE_UUID);
            
            writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
            notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);

            await notifyChar.startNotifications();
            notifyChar.addEventListener('characteristicvaluechanged', handleNotify);

            // Initial Sync
            sendData("SYNC_BOARDS");
            document.getElementById('connection-screen').classList.add('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('control-panel').classList.remove('hidden');
        } catch (e) { console.error("Connection Failed", e); }
    }

    // --- Data Processing ---
    function handleNotify(event) {
        const decoder = new TextDecoder();
        bleBuffer += decoder.decode(event.target.value);

        if (bleBuffer.includes('\n')) {
            const lines = bleBuffer.split('\n');
            bleBuffer = lines.pop(); // Keep incomplete fragment
            lines.forEach(line => processMessage(line.trim()));
        }
    }

    function processMessage(msg) {
        if (msg.startsWith("BOARDS:")) {
            const count = parseInt(msg.split(":")[1]);
            initBoards(count);
        } else if (msg.includes("_ARMED") || msg.includes("_DISARMED")) {
            const parts = msg.split("_"); // B0, CH1, ARMED
            const bId = parseInt(parts[0].substring(1));
            const cId = parseInt(parts[1].substring(2));
            const status = parts[2].toLowerCase();
            if(state.boards[bId]) {
                state.boards[bId].channels[cId] = status;
                render();
            }
        }
    }

    function initBoards(count) {
        state.boards = { 0: { id: 0, name: 'Master Unit', channels: {} } };
        for (let i = 1; i <= 6; i++) state.boards[0].channels[i] = 'disarmed';
        
        for (let i = 1; i <= count; i++) {
            state.boards[i] = { id: i, name: `Aux Board ${i}`, channels: {} };
            for (let j = 1; j <= 6; j++) state.boards[i].channels[j] = 'disarmed';
        }
        render();
    }

    // --- UI Rendering ---
    function render() {
        const board = state.boards[state.selectedBoardId];
        boardTitle.textContent = board.name;
        
        // Render Sidebar
        boardList.innerHTML = Object.values(state.boards).map(b => `
            <li onclick="window.selectBoard(${b.id})" class="p-3 mb-2 rounded cursor-pointer ${b.id === state.selectedBoardId ? 'bg-blue-600' : 'bg-gray-700'}">
                ${b.name}
            </li>
        `).join('');

        // Render Channels
        channelGrid.innerHTML = Object.entries(board.channels).map(([id, status]) => `
            <div class="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col items-center">
                <span class="text-sm text-gray-400 uppercase tracking-widest mb-2">Channel ${id}</span>
                <div class="status-indicator w-4 h-4 rounded-full mb-6 ${status}"></div>
                <div class="flex gap-3">
                    <button onclick="sendAction(${id}, 'ARM')" class="bg-green-600 px-4 py-2 rounded font-bold">ARM</button>
                    <button onclick="sendAction(${id}, 'DISARM')" class="bg-red-600 px-4 py-2 rounded font-bold">SAFE</button>
                </div>
            </div>
        `).join('');
    }

    window.selectBoard = (id) => { state.selectedBoardId = id; render(); };
    
    window.sendAction = (ch, action) => {
        sendData(`B${state.selectedBoardId}_CH${ch}_${action}`);
    };

    async function sendData(str) {
        if (!writeChar) return;
        await writeChar.writeValue(new TextEncoder().encode(str + "\n"));
    }

    connectBtn.addEventListener('click', connect);
    refreshBtn.addEventListener('click', () => sendData("SYNC_ALL"));
});