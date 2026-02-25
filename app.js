document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    const CHAR_WRITE_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
    const CHAR_NOTIFY_UUID = "498c599b-ad01-4148-8a6a-73c332854747";

    let bleDevice, bleServer, writeChar, notifyChar;
    let bleBuffer = ""; // Buffers incoming data to handle packet fragmentation

    let state = {
        boards: {}, // Stores: { 0: { name: 'Master', channels: { 1: 'disarmed', ... }, connected: true } }
        selectedBoardId: 0
    };

    // --- DOM Elements ---
    const connectBtn = document.getElementById('connect-button');
    const mockBtn = document.getElementById('mock-button');
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
            enterApp();
        } catch (e) { console.error("Connection Failed", e); }
    }

    function enterApp() {
        document.getElementById('connection-screen').classList.add('hidden');
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('control-panel').classList.remove('hidden');
    }

    // --- Simulation Logic ---
    function startSimulation() {
        console.log("SIMULATION MODE ACTIVE");
        console.log("Use window.simulateMsg('MESSAGE') to test events.");
        console.log("Example: window.simulateMsg('B1_DISCONNECTED')");
        
        enterApp();
        processMessage("BOARDS:2"); // Booster, Ignition, Nose Cone
    }

    window.simulateMsg = (msg) => processMessage(msg);

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
        } else if (msg.endsWith("_DISCONNECTED")) {
            const bId = parseInt(msg.substring(1, msg.indexOf('_')));
            if (state.boards[bId]) {
                state.boards[bId].connected = false;
                render();
            }
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
        const boardNames = {
            0: "Booster Bay",
            1: "Ignition Bay",
            2: "Nose Cone"
        };

        state.boards = {};
        for (let i = 0; i <= count; i++) {
            state.boards[i] = { 
                id: i, 
                name: boardNames[i] || `Aux Board ${i}`, 
                channels: {},
                connected: true
            };
            for (let j = 1; j <= 6; j++) state.boards[i].channels[j] = 'disarmed';
        }
        render();
    }

    // --- UI Rendering ---
    function render() {
        if (Object.keys(state.boards).length === 0) return;
        
        const board = state.boards[state.selectedBoardId];
        const isDisconnected = !board.connected;
        const isBoardArmed = Object.values(board.channels).some(s => s === 'armed');
        
        boardTitle.innerHTML = `
            <div class="w-4 h-4 rounded-full shadow-lg transition-colors duration-500 ${isBoardArmed ? 'bg-green-500 shadow-green-900/40' : 'bg-red-600 shadow-red-900/40'}"></div>
            ${board.name}
            ${isDisconnected ? '<span class="ml-4 text-[10px] bg-red-600/20 text-red-500 border border-red-500/50 px-3 py-1 rounded-full uppercase tracking-tighter">Link Severed</span>' : ''}
        `;
        
        // Render Sidebar
        boardList.innerHTML = Object.values(state.boards).map(b => `
            <li onclick="window.selectBoard(${b.id})" class="p-4 mb-3 rounded-lg cursor-pointer transition-all border border-transparent ${b.id === state.selectedBoardId ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-900/40' : 'bg-slate-800 hover:bg-slate-700'} ${!b.connected ? 'opacity-40 grayscale' : ''}">
                <div class="flex justify-between items-center">
                    <span class="font-black text-xs uppercase tracking-widest">${b.name}</span>
                    ${!b.connected ? '<span class="text-[8px] font-black text-red-500">OFFLINE</span>' : '<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></span>'}
                </div>
            </li>
        `).join('');

        // Render Channels
        channelGrid.innerHTML = Object.entries(board.channels).map(([id, status]) => `
            <div class="channel-card p-10 rounded-3xl border-2 border-slate-800 flex flex-col items-center relative overflow-hidden group transition-all hover:translate-y-[-2px]">
                ${isDisconnected ? '<div class="absolute inset-0 bg-slate-950/70 z-20 flex items-center justify-center backdrop-blur-md"><span class="text-red-500 font-black text-xs tracking-[0.5em] rotate-[-15deg] border-4 border-red-500 px-4 py-2">MALFUNCTION</span></div>' : ''}
                
                <div class="absolute top-6 left-6 text-[9px] text-slate-500 font-black uppercase tracking-widest opacity-50">Relay 0${id}</div>
                <div class="absolute top-6 right-6 text-[9px] ${status === 'armed' ? 'text-red-500' : 'text-green-500'} font-black uppercase tracking-widest">${status}</div>

                <div class="status-indicator w-20 h-1.5 rounded-full mb-12 ${status}"></div>
                
                <h3 class="text-slate-400 text-[11px] font-black uppercase tracking-[0.5em] mb-12">System Control</h3>

                <div class="flex gap-6 w-full px-2">
                    <button onclick="sendAction(${id}, 'ARM')" ${isDisconnected ? 'disabled' : ''} 
                        class="btn-industrial flex-1 bg-red-600 border-red-900 hover:bg-red-500 disabled:bg-slate-800 disabled:border-slate-900 disabled:text-slate-600 py-5 rounded-2xl text-[11px] ${status === 'armed' ? 'active' : ''}">
                        ARM
                    </button>
                    <button onclick="sendAction(${id}, 'DISARM')" ${isDisconnected ? 'disabled' : ''} 
                        class="btn-industrial flex-1 bg-emerald-600 border-emerald-900 hover:bg-emerald-500 disabled:bg-slate-800 disabled:border-slate-900 disabled:text-slate-600 py-5 rounded-2xl text-[11px] ${status === 'disarmed' ? 'active' : ''}">
                        DISARM
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.selectBoard = (id) => { state.selectedBoardId = id; render(); };
    
    window.sendAction = (ch, action) => {
        sendData(`B${state.selectedBoardId}_CH${ch}_${action}`);
    };

    async function sendData(str) {
        console.log("OUTGOING:", str);
        if (!writeChar) return;
        await writeChar.writeValue(new TextEncoder().encode(str + "\n"));
    }

    connectBtn.addEventListener('click', connect);
    mockBtn.addEventListener('click', startSimulation);
    refreshBtn.addEventListener('click', () => sendData("SYNC_ALL"));
});