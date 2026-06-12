/**
 * ============================================
 * GBA 模拟器核心逻辑
 * 基于 mGBA WebAssembly 核心
 * ============================================
 */

// ============================================
// 全局状态管理
// ============================================
const EmulatorState = {
    core: null,           // mGBA 核心实例
    canvas: null,         // 游戏画面 Canvas
    ctx: null,            // Canvas 2D 上下文
    romLoaded: false,     // ROM 是否已加载
    isRunning: false,     // 游戏是否运行中
    isPaused: false,      // 是否暂停
    saveStateSlot: 0,     // 存档槽位
    volume: 0.5,          // 音量 (0-1)
    audioContext: null,   // Web Audio 上下文
    gameLoopId: null,     // 游戏循环 ID
    keyState: {},         // 按键状态
};

// ============================================
// GBA 按键映射常量
// ============================================
const GBA_KEYS = {
    A: 0,
    B: 1,
    SELECT: 2,
    START: 3,
    RIGHT: 4,
    LEFT: 5,
    UP: 6,
    DOWN: 7,
    R: 8,
    L: 9,
};

// ============================================
// 键盘映射配置
// ============================================
const KEYBOARD_MAP = {
    // 方向键
    'ArrowUp':    GBA_KEYS.UP,
    'ArrowDown':  GBA_KEYS.DOWN,
    'ArrowLeft':  GBA_KEYS.LEFT,
    'ArrowRight': GBA_KEYS.RIGHT,
    'w':          GBA_KEYS.UP,
    'W':          GBA_KEYS.UP,
    's':          GBA_KEYS.DOWN,
    'S':          GBA_KEYS.DOWN,
    'a':          GBA_KEYS.LEFT,
    'A':          GBA_KEYS.LEFT,
    'd':          GBA_KEYS.RIGHT,
    'D':          GBA_KEYS.RIGHT,

    // 功能键
    'z':          GBA_KEYS.A,
    'Z':          GBA_KEYS.A,
    'x':          GBA_KEYS.B,
    'X':          GBA_KEYS.B,
    'a':          GBA_KEYS.L,
    'A':          GBA_KEYS.L,
    's':          GBA_KEYS.R,
    'S':          GBA_KEYS.R,

    // 系统键
    'Enter':      GBA_KEYS.START,
    'Shift':      GBA_KEYS.SELECT,
    'ShiftLeft':  GBA_KEYS.SELECT,
    'ShiftRight': GBA_KEYS.SELECT,
};

// 特殊功能键（不映射到 GBA 按键）
const SPECIAL_KEYS = {
    'p': 'pause',
    'P': 'pause',
    'r': 'reset',
    'R': 'reset',
    'F1': 'loadState',
};

// ============================================
// DOM 元素引用
// ============================================
let dom = {};

function initDOM() {
    dom = {
        canvas: document.getElementById('game-canvas'),
        loadingOverlay: document.getElementById('loading-overlay'),
        startOverlay: document.getElementById('start-overlay'),
        btnLoadRom: document.getElementById('btn-load-rom'),
        romFileInput: document.getElementById('rom-file-input'),
        btnFullscreen: document.getElementById('btn-fullscreen'),
        btnSaveState: document.getElementById('btn-save-state'),
        btnLoadState: document.getElementById('btn-load-state'),
        btnReset: document.getElementById('btn-reset'),
        btnPause: document.getElementById('btn-pause'),
        volumeSlider: document.getElementById('volume-slider'),
        // 虚拟按键
        virtualButtons: document.querySelectorAll('[data-key]'),
    };

    EmulatorState.canvas = dom.canvas;
    EmulatorState.ctx = dom.canvas.getContext('2d');
}

// ============================================
// mGBA 核心加载与初始化
// ============================================

/**
 * 初始化模拟器核心
 */
async function initEmulator() {
    initDOM();
    setupEventListeners();

    try {
        // 使用 EmulatorJS 的加载器初始化 mGBA 核心
        await loadMGBACore();
    } catch (error) {
        console.error('加载 mGBA 核心失败:', error);
        showLoadingText('核心加载失败，请刷新页面重试');
    }
}

/**
 * 加载 mGBA WebAssembly 核心
 */
function loadMGBACore() {
    return new Promise((resolve, reject) => {
        // 检查 EmulatorJS 加载器是否可用
        if (typeof window.EJS_load === 'undefined' && typeof window.loadEmulator === 'undefined') {
            // 如果 CDN 加载器不可用，使用内联核心加载
            loadCoreFromCDN(resolve, reject);
        } else {
            // 使用 EmulatorJS 加载器
            initEmulatorJS(resolve, reject);
        }
    });
}

/**
 * 从 CDN 加载 mGBA 核心
 */
function loadCoreFromCDN(resolve, reject) {
    const coreUrl = 'https://cdn.emulatorjs.org/nightly/data/cores/mgba-wasm.data';

    // 创建 mGBA 模块配置
    window.Module = {
        canvas: dom.canvas,
        print: (text) => console.log('mGBA:', text),
        printErr: (text) => console.error('mGBA:', text),
        onRuntimeInitialized: () => {
            console.log('mGBA 核心初始化完成');
            EmulatorState.core = window.Module;
            onCoreReady();
            resolve();
        },
        onAbort: (err) => {
            console.error('mGBA 核心加载失败:', err);
            reject(err);
        },
        locateFile: (path) => {
            if (path.endsWith('.wasm')) {
                return 'https://cdn.emulatorjs.org/nightly/data/cores/mgba-wasm.wasm';
            }
            if (path.endsWith('.data')) {
                return coreUrl;
            }
            return path;
        }
    };

    // 动态加载 mGBA JavaScript 运行时
    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/nightly/data/cores/mgba-wasm.js';
    script.onerror = () => {
        // 如果 CDN 加载失败，使用备用方案
        console.warn('CDN 加载失败，尝试备用方案');
        initFallbackCore(resolve, reject);
    };
    document.body.appendChild(script);
}

/**
 * 备用核心初始化（简化版）
 */
function initFallbackCore(resolve, reject) {
    // 尝试从另一个 CDN 加载
    const altScript = document.createElement('script');
    altScript.src = 'https://cdn.jsdelivr.net/gh/ethanaobrien/emulatorjs@main/data/cores/mgba-wasm.js';
    altScript.onload = () => {
        console.log('备用 CDN 加载成功');
    };
    altScript.onerror = () => {
        showLoadingText('无法从 CDN 加载核心，请检查网络连接');
        reject(new Error('核心加载失败'));
    };
    document.body.appendChild(altScript);

    // 设置超时
    setTimeout(() => {
        if (!EmulatorState.core) {
            showLoadingText('核心加载超时，请检查网络');
        }
    }, 30000);
}

/**
 * 使用 EmulatorJS 架构初始化
 */
function initEmulatorJS(resolve, reject) {
    const config = {
        system: 'gba',
        core: 'mgba',
        canvas: dom.canvas,
        gameUrl: null,
        loadStateOnStart: false,
        onReady: () => {
            console.log('EmulatorJS 准备就绪');
            onCoreReady();
            resolve();
        },
        onError: (err) => {
            console.error('EmulatorJS 错误:', err);
            reject(err);
        }
    };

    if (window.EJS_load) {
        window.EJS_load(config);
    } else if (window.loadEmulator) {
        window.loadEmulator(config);
    }
}

/**
 * 核心准备就绪后的回调
 */
function onCoreReady() {
    hideLoadingOverlay();
    showStartOverlay();
    initAudio();
    console.log('模拟器已就绪，等待加载 ROM');
}

// ============================================
// ROM 加载
// ============================================

/**
 * 处理 ROM 文件选择
 */
function handleRomSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    loadRomFile(file);
}

/**
 * 加载 ROM 文件
 */
function loadRomFile(file) {
    showLoadingText('正在加载 ROM...');

    const reader = new FileReader();
    reader.onload = (e) => {
        const romData = new Uint8Array(e.target.result);
        startGame(romData, file.name);
    };
    reader.onerror = () => {
        showLoadingText('ROM 读取失败');
    };
    reader.readAsArrayBuffer(file);
}

/**
 * 启动游戏
 */
function startGame(romData, fileName) {
    try {
        if (EmulatorState.core) {
            // 使用 mGBA 核心加载 ROM
            loadRomToCore(romData, fileName);
        } else {
            // 核心尚未加载，等待后重试
            setTimeout(() => startGame(romData, fileName), 500);
            return;
        }

        EmulatorState.romLoaded = true;
        EmulatorState.isRunning = true;
        EmulatorState.isPaused = false;

        hideStartOverlay();
        hideLoadingOverlay();

        // 开始游戏循环
        startGameLoop();

        console.log(`游戏已启动: ${fileName}`);
    } catch (error) {
        console.error('启动游戏失败:', error);
        showLoadingText('启动游戏失败: ' + error.message);
    }
}

/**
 * 将 ROM 加载到核心
 */
function loadRomToCore(romData, fileName) {
    const core = EmulatorState.core;

    // 创建虚拟文件系统路径
    const romPath = '/game.gba';

    // 将 ROM 数据写入虚拟文件系统
    if (core.FS) {
        // 确保目录存在
        try {
            core.FS.mkdir('/data');
        } catch (e) {
            // 目录可能已存在
        }

        core.FS.writeFile(romPath, romData);

        // 调用 mGBA 的加载函数
        if (core.ccall) {
            core.ccall('loadROM', 'number', ['string'], [romPath]);
        } else if (core._loadROM) {
            core._loadROM(romPath);
        }
    }

    // 如果使用 EmulatorJS API
    if (core.loadRom) {
        core.loadRom(romData);
    }
}

// ============================================
// 游戏循环
// ============================================

/**
 * 启动游戏循环
 */
function startGameLoop() {
    if (EmulatorState.gameLoopId) {
        cancelAnimationFrame(EmulatorState.gameLoopId);
    }

    let lastTime = performance.now();
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    function loop(currentTime) {
        EmulatorState.gameLoopId = requestAnimationFrame(loop);

        if (EmulatorState.isPaused || !EmulatorState.isRunning) {
            return;
        }

        const deltaTime = currentTime - lastTime;

        if (deltaTime >= frameInterval) {
            lastTime = currentTime - (deltaTime % frameInterval);
            runFrame();
        }
    }

    EmulatorState.gameLoopId = requestAnimationFrame(loop);
}

/**
 * 运行一帧
 */
function runFrame() {
    const core = EmulatorState.core;
    if (!core) return;

    // 更新按键状态
    updateInputState();

    // 调用核心运行帧
    if (core.ccall) {
        core.ccall('runFrame', null, [], []);
    } else if (core._runFrame) {
        core._runFrame();
    } else if (core.runFrame) {
        core.runFrame();
    }

    // 渲染画面
    renderFrame();

    // 处理音频
    processAudio();
}

/**
 * 渲染画面到 Canvas
 */
function renderFrame() {
    const core = EmulatorState.core;
    if (!core || !EmulatorState.ctx) return;

    // 从核心获取画面数据
    let imageData = null;

    if (core.HEAPU8 && core._getFrameBuffer) {
        const bufferPtr = core._getFrameBuffer();
        const buffer = new Uint8ClampedArray(
            core.HEAPU8.buffer,
            bufferPtr,
            240 * 160 * 4
        );
        imageData = new ImageData(buffer, 240, 160);
    } else if (core.getFrameBuffer) {
        const buffer = core.getFrameBuffer();
        if (buffer) {
            imageData = new ImageData(
                new Uint8ClampedArray(buffer),
                240, 160
            );
        }
    }

    if (imageData) {
        EmulatorState.ctx.putImageData(imageData, 0, 0);
    }
}

// ============================================
// 输入处理
// ============================================

/**
 * 更新输入状态到核心
 */
function updateInputState() {
    const core = EmulatorState.core;
    if (!core) return;

    for (let keyId = 0; keyId <= 9; keyId++) {
        const isPressed = !!EmulatorState.keyState[keyId];
        setKeyState(keyId, isPressed);
    }
}

/**
 * 设置单个按键状态
 */
function setKeyState(keyId, pressed) {
    const core = EmulatorState.core;
    if (!core) return;

    if (core.ccall) {
        core.ccall('setKeyState', null, ['number', 'number'], [keyId, pressed ? 1 : 0]);
    } else if (core._setKeyState) {
        core._setKeyState(keyId, pressed ? 1 : 0);
    } else if (core.setKeyState) {
        core.setKeyState(keyId, pressed);
    }
}

/**
 * 处理按键按下
 */
function handleKeyDown(keyId) {
    EmulatorState.keyState[keyId] = true;
}

/**
 * 处理按键释放
 */
function handleKeyUp(keyId) {
    EmulatorState.keyState[keyId] = false;
}

// ============================================
// 事件监听设置
// ============================================

function setupEventListeners() {
    // ROM 文件选择
    dom.btnLoadRom.addEventListener('click', () => {
        dom.romFileInput.click();
    });
    dom.romFileInput.addEventListener('change', handleRomSelect);

    // 全屏按钮
    dom.btnFullscreen.addEventListener('click', toggleFullscreen);

    // 存档/读档
    dom.btnSaveState.addEventListener('click', saveState);
    dom.btnLoadState.addEventListener('click', loadState);

    // 重置/暂停
    dom.btnReset.addEventListener('click', resetGame);
    dom.btnPause.addEventListener('click', togglePause);

    // 音量控制
    dom.volumeSlider.addEventListener('input', (e) => {
        EmulatorState.volume = e.target.value / 100;
        updateVolume();
    });

    // 键盘事件
    setupKeyboardListeners();

    // 虚拟按键触摸事件
    setupVirtualButtonListeners();

    // 防止触摸滚动
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('.virtual-controls')) {
            e.preventDefault();
        }
    }, { passive: false });
}

/**
 * 设置键盘监听
 */
function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        const key = e.key;
        const code = e.code;

        // 检查是否为 GBA 按键映射
        const gbaKey = KEYBOARD_MAP[key] ?? KEYBOARD_MAP[code];
        if (gbaKey !== undefined) {
            e.preventDefault();
            handleKeyDown(gbaKey);
        }

        // 检查特殊功能键
        if (!e.repeat) {
            if (key === 'p' || key === 'P') {
                togglePause();
            } else if (key === 'r' || key === 'R') {
                resetGame();
            } else if (key === 'F1') {
                if (e.shiftKey) {
                    saveState();
                } else {
                    loadState();
                }
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key;
        const code = e.code;

        const gbaKey = KEYBOARD_MAP[key] ?? KEYBOARD_MAP[code];
        if (gbaKey !== undefined) {
            e.preventDefault();
            handleKeyUp(gbaKey);
        }
    });
}

/**
 * 设置虚拟按键触摸监听
 */
function setupVirtualButtonListeners() {
    dom.virtualButtons.forEach((btn) => {
        const keyName = btn.dataset.key;
        const gbaKey = GBA_KEYS[keyName.toUpperCase()];

        if (gbaKey === undefined) return;

        // 触摸开始
        const onTouchStart = (e) => {
            e.preventDefault();
            btn.classList.add('active');
            handleKeyDown(gbaKey);
            document.body.classList.add('touch-active');
        };

        // 触摸结束
        const onTouchEnd = (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            handleKeyUp(gbaKey);
            document.body.classList.remove('touch-active');
        };

        // 鼠标按下（桌面端测试用）
        const onMouseDown = (e) => {
            e.preventDefault();
            btn.classList.add('active');
            handleKeyDown(gbaKey);
        };

        // 鼠标释放
        const onMouseUp = (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            handleKeyUp(gbaKey);
        };

        // 鼠标离开
        const onMouseLeave = (e) => {
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                handleKeyUp(gbaKey);
            }
        };

        btn.addEventListener('touchstart', onTouchStart, { passive: false });
        btn.addEventListener('touchend', onTouchEnd, { passive: false });
        btn.addEventListener('touchcancel', onTouchEnd, { passive: false });
        btn.addEventListener('mousedown', onMouseDown);
        btn.addEventListener('mouseup', onMouseUp);
        btn.addEventListener('mouseleave', onMouseLeave);
    });
}

// ============================================
// 音频处理
// ============================================

/**
 * 初始化音频系统
 */
function initAudio() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            EmulatorState.audioContext = new AudioContext();
        }
    } catch (e) {
        console.warn('Web Audio API 不可用:', e);
    }
}

/**
 * 处理音频帧
 */
function processAudio() {
    const core = EmulatorState.core;
    if (!core || !EmulatorState.audioContext) return;

    // 从核心获取音频数据
    if (core.ccall) {
        const audioBufferPtr = core.ccall('getAudioBuffer', 'number', [], []);
        if (audioBufferPtr) {
            // 处理音频数据...
        }
    }
}

/**
 * 更新音量
 */
function updateVolume() {
    // 实现音量调整逻辑
    console.log('音量设置为:', EmulatorState.volume);
}

// ============================================
// 存档 / 读档
// ============================================

/**
 * 保存存档
 */
function saveState() {
    if (!EmulatorState.romLoaded) {
        console.warn('没有加载的游戏');
        return;
    }

    try {
        const core = EmulatorState.core;
        const slot = EmulatorState.saveStateSlot;

        if (core && core.ccall) {
            core.ccall('saveState', null, ['number'], [slot]);
        } else if (core && core.saveState) {
            core.saveState(slot);
        }

        // 同时保存到本地存储
        saveStateToLocal();

        showNotification('存档已保存');
        console.log(`存档已保存到槽位 ${slot}`);
    } catch (error) {
        console.error('存档失败:', error);
        showNotification('存档失败');
    }
}

/**
 * 读取存档
 */
function loadState() {
    if (!EmulatorState.romLoaded) {
        console.warn('没有加载的游戏');
        return;
    }

    try {
        const core = EmulatorState.core;
        const slot = EmulatorState.saveStateSlot;

        // 先尝试从本地存储加载
        const localState = loadStateFromLocal();
        if (localState) {
            // 恢复本地存档
            restoreStateFromLocal(localState);
            showNotification('存档已读取');
            return;
        }

        if (core && core.ccall) {
            core.ccall('loadState', null, ['number'], [slot]);
        } else if (core && core.loadState) {
            core.loadState(slot);
        }

        showNotification('存档已读取');
        console.log(`存档已从槽位 ${slot} 读取`);
    } catch (error) {
        console.error('读档失败:', error);
        showNotification('读档失败');
    }
}

/**
 * 保存存档到本地存储
 */
function saveStateToLocal() {
    const core = EmulatorState.core;
    if (!core || !core.FS) return;

    try {
        // 读取 mGBA 的存档文件
        const savePath = '/data/game.sav';
        if (core.FS.analyzePath(savePath).exists) {
            const saveData = core.FS.readFile(savePath);
            const base64 = arrayBufferToBase64(saveData);
            localStorage.setItem('gba_save_state', base64);
            localStorage.setItem('gba_save_time', Date.now().toString());
        }
    } catch (e) {
        console.warn('本地存档保存失败:', e);
    }
}

/**
 * 从本地存储读取存档
 */
function loadStateFromLocal() {
    const data = localStorage.getItem('gba_save_state');
    if (data) {
        return base64ToArrayBuffer(data);
    }
    return null;
}

/**
 * 从本地存档恢复
 */
function restoreStateFromLocal(stateData) {
    const core = EmulatorState.core;
    if (!core || !core.FS) return;

    try {
        core.FS.writeFile('/data/game.sav', new Uint8Array(stateData));

        if (core.ccall) {
            core.ccall('loadSave', null, ['string'], ['/data/game.sav']);
        }
    } catch (e) {
        console.warn('本地存档恢复失败:', e);
    }
}

// ============================================
// 游戏控制
// ============================================

/**
 * 重置游戏
 */
function resetGame() {
    if (!EmulatorState.romLoaded) return;

    const core = EmulatorState.core;
    if (core && core.ccall) {
        core.ccall('reset', null, [], []);
    } else if (core && core.reset) {
        core.reset();
    }

    EmulatorState.isPaused = false;
    updatePauseButton();
    showNotification('游戏已重置');
    console.log('游戏已重置');
}

/**
 * 暂停/继续切换
 */
function togglePause() {
    if (!EmulatorState.romLoaded) return;

    EmulatorState.isPaused = !EmulatorState.isPaused;
    updatePauseButton();
    showNotification(EmulatorState.isPaused ? '游戏已暂停' : '游戏继续');
    console.log(EmulatorState.isPaused ? '游戏已暂停' : '游戏继续');
}

/**
 * 更新暂停按钮状态
 */
function updatePauseButton() {
    if (EmulatorState.isPaused) {
        dom.btnPause.innerHTML = '<span class="icon">▶</span> 继续';
    } else {
        dom.btnPause.innerHTML = '<span class="icon">⏸</span> 暂停';
    }
}

// ============================================
// 全屏功能
// ============================================

/**
 * 切换全屏模式
 */
function toggleFullscreen() {
    const wrapper = document.querySelector('.game-screen-wrapper');

    if (!document.fullscreenElement) {
        if (wrapper.requestFullscreen) {
            wrapper.requestFullscreen();
        } else if (wrapper.webkitRequestFullscreen) {
            wrapper.webkitRequestFullscreen();
        } else if (wrapper.msRequestFullscreen) {
            wrapper.msRequestFullscreen();
        }
        document.body.classList.add('fullscreen');
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        document.body.classList.remove('fullscreen');
    }
}

// 监听全屏变化
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen');
    }
});

// ============================================
// UI 辅助函数
// ============================================

function showLoadingOverlay() {
    dom.loadingOverlay.classList.remove('hidden');
}

function hideLoadingOverlay() {
    dom.loadingOverlay.classList.add('hidden');
}

function showStartOverlay() {
    dom.startOverlay.classList.remove('hidden');
}

function hideStartOverlay() {
    dom.startOverlay.classList.add('hidden');
}

function showLoadingText(text) {
    const textEl = dom.loadingOverlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = text;
    showLoadingOverlay();
}

/**
 * 显示通知提示
 */
function showNotification(message) {
    // 创建通知元素
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            background: var(--bg-secondary);
            border: 1px solid var(--accent-primary);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.9rem;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.style.opacity = '1';

    setTimeout(() => {
        notification.style.opacity = '0';
    }, 2000);
}

// ============================================
// 工具函数
// ============================================

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Base64 转 ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// ============================================
// 启动模拟器
// ============================================

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initEmulator);

// 导出全局函数供调试使用
window.GBAEmulator = {
    state: EmulatorState,
    saveState,
    loadState,
    resetGame,
    togglePause,
    toggleFullscreen,
};
