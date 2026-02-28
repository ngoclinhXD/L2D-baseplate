window.PIXI = PIXI;

async function initLive2D() {
    const loadingScreen = document.getElementById('loading-screen');
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');

    const app = new PIXI.Application({
        view: document.getElementById('live2d-canvas'),
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: window
    });

    let modelUrl = './model/huohuo.model3.json';
    
    function updateProgress(ratio) {
        const percent = Math.round(ratio * 100);
        progressBar.style.width = percent + '%';
        loadingText.innerText = `Loading: ${percent}%`;
    }

    let model = await PIXI.live2d.Live2DModel.from(modelUrl, {
        onProgress: updateProgress
    });
    
    loadingScreen.classList.add('hidden');
    app.stage.addChild(model);

    let offsetX = 350;
    let offsetY = 800;
    let baseScale = 0.3;
    let eyeLevelOffset = 0.25;

    let hbOffsetX = 0;
    let hbOffsetY = -2000;
    let hbWidth = 800;
    let hbHeight = 600;

    const savedTransformStr = localStorage.getItem('modelTransform');
    if (savedTransformStr) {
        try {
            const savedT = JSON.parse(savedTransformStr);
            if (savedT.offsetX !== undefined) offsetX = savedT.offsetX;
            if (savedT.offsetY !== undefined) offsetY = savedT.offsetY;
            if (savedT.scale !== undefined) baseScale = savedT.scale;
        } catch(e) {}
    }

    const savedEyeLevel = localStorage.getItem('eyeLevelOffset');
    if (savedEyeLevel) eyeLevelOffset = parseFloat(savedEyeLevel);

    const savedHb = localStorage.getItem('headHitbox');
    if (savedHb) {
        try {
            const hb = JSON.parse(savedHb);
            hbOffsetX = hb.x;
            hbOffsetY = hb.y;
            hbWidth = hb.w;
            hbHeight = hb.h;
        } catch(e) {}
    }

    let tempOffsetX = offsetX;
    let tempOffsetY = offsetY;
    let tempScale = baseScale;

    let isTrackingMouse = true;
    let isPlayingMotion = false;
    let hasPlayedMotion = false;
    let isAdjustMode = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let isCalibratingUI = false;
    let isDraggingLine = false;

    let isDraggingBox = false;
    let isResizingBox = false;

    let isMouseDown = false;
    let isHeadpatSession = false;
    let isPatting = false;
    let wasPatting = false;
    let blinkTimer = 0;
    const blinkInterval = 5000;
    const blinkDuration = 200;
    
    let lastMouseX = 0;
    let lastMouseY = 0;

    function applyTransform(scale, offX, offY) {
        model.scale.set(scale);
        model.x = (app.renderer.width / 2) + offX;
        model.y = (app.renderer.height / 2) + offY;
    }

    function setupModel(m) {
        m.anchor.set(0.5, 0.5);
        applyTransform(baseScale, offsetX, offsetY);
    }

    setupModel(model);

    const headHitbox = document.getElementById('head-hitbox');
    const resizeHandle = document.getElementById('hitbox-resize-handle');

    if (headHitbox) headHitbox.style.display = 'none';

    function updateBoxPosition() {
        if (!headHitbox) return;
        
        let boxW = hbWidth * model.scale.x;
        let boxH = hbHeight * model.scale.y;
        let boxLeft = model.x + hbOffsetX * model.scale.x - boxW / 2;
        let boxTop = model.y + hbOffsetY * model.scale.y - boxH / 2;

        if (boxTop > window.innerHeight || boxTop + boxH < 0 || boxLeft > window.innerWidth || boxLeft + boxW < 0) {
            hbOffsetX = 0;
            hbOffsetY = - (model.height * eyeLevelOffset) / model.scale.y;
            boxLeft = model.x + hbOffsetX * model.scale.x - boxW / 2;
            boxTop = model.y + hbOffsetY * model.scale.y - boxH / 2;
        }

        headHitbox.style.width = boxW + 'px';
        headHitbox.style.height = boxH + 'px';
        headHitbox.style.left = boxLeft + 'px';
        headHitbox.style.top = boxTop + 'px';
    }

    app.ticker.add(() => {
        if (!model || !model.internalModel) return;

        const core = model.internalModel.coreModel;
        const eyeIds = ['ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeOpenL', 'ParamEyeOpenR'];

        if (isHeadpatSession) {
            if (model.internalModel.focusController) {
                model.internalModel.focusController.focus(0, 0);
            }
            const headX = model.x;
            const headY = model.y - (model.height * eyeLevelOffset);
            const dx = (lastMouseX - headX) * 0.03;
            const dy = (lastMouseY - headY) * 0.03;
            
            core.setParameterValueById('ParamAngleX', dx);
            core.setParameterValueById('ParamAngleY', -dy);
        } else if (!isTrackingMouse || isCalibratingUI || isAdjustMode) {
            if (!isPlayingMotion && model.internalModel.focusController) {
                model.internalModel.focusController.focus(0, 0);
            }
        }

        if (isPatting) {
            eyeIds.forEach(id => core.setParameterValueById(id, 0));
            wasPatting = true;
            return;
        } else if (wasPatting) {
            eyeIds.forEach(id => core.setParameterValueById(id, 1));
            wasPatting = false;
            blinkTimer = 0;
        }

        blinkTimer += app.ticker.deltaMS;
        if (blinkTimer >= blinkInterval) {
            const timeInBlink = blinkTimer - blinkInterval;
            if (timeInBlink < blinkDuration) {
                const progress = timeInBlink / blinkDuration;
                const eyeValue = Math.abs(Math.cos(progress * Math.PI));
                eyeIds.forEach(id => core.setParameterValueById(id, eyeValue));
            } else {
                blinkTimer = 0;
            }
        }
    });

    function checkInBox(clientX, clientY) {
        const rect = app.view.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const boxW = hbWidth * model.scale.x;
        const boxH = hbHeight * model.scale.y;
        const boxX = model.x + hbOffsetX * model.scale.x - boxW/2;
        const boxY = model.y + hbOffsetY * model.scale.y - boxH/2;

        return (x > boxX && x < boxX + boxW && y > boxY && y < boxY + boxH);
    }

    window.addEventListener('resize', () => {
        if (isAdjustMode) {
            applyTransform(tempScale, tempOffsetX, tempOffsetY);
        } else {
            applyTransform(baseScale, offsetX, offsetY);
        }
        if (isCalibratingUI) updateBoxPosition();
    });

    app.view.addEventListener('mousedown', (e) => {
        if (isAdjustMode) {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
        } else if (!isCalibratingUI) {
            isMouseDown = true;
            if (checkInBox(e.clientX, e.clientY)) {
                isHeadpatSession = true;
                isPatting = true;
            }
        }
    });

    if (headHitbox) {
        headHitbox.addEventListener('mousedown', (e) => {
            if (!isCalibratingUI || e.target === resizeHandle) return;
            isDraggingBox = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            e.stopPropagation();
        });
    }

    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            if (!isCalibratingUI) return;
            isResizingBox = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            e.stopPropagation();
        });
    }

    const calibHandle = document.querySelector('.calib-handle');
    const calibrationLine = document.getElementById('calibration-line');
    
    if (calibHandle) {
        calibHandle.addEventListener('mousedown', (e) => {
            if (!isCalibratingUI) return;
            isDraggingLine = true;
            e.stopPropagation();
        });
    }

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isDraggingLine = false;
        isDraggingBox = false;
        isResizingBox = false;
        isMouseDown = false;
        isHeadpatSession = false;
        isPatting = false;
    });

    window.addEventListener('mousemove', (event) => {
        const rect = app.view.getBoundingClientRect();
        lastMouseX = event.clientX - rect.left;
        lastMouseY = event.clientY - rect.top;

        if (isAdjustMode && isDragging) {
            const dx = event.clientX - dragStartX;
            const dy = event.clientY - dragStartY;
            tempOffsetX += dx;
            tempOffsetY += dy;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            applyTransform(tempScale, tempOffsetX, tempOffsetY);
        } else if (isCalibratingUI) {
            if (isDraggingLine) {
                let newLineY = event.clientY;
                calibrationLine.style.top = `${newLineY}px`;
                eyeLevelOffset = (model.y - newLineY) / model.height;
            } else if (isDraggingBox) {
                const dx = event.clientX - dragStartX;
                const dy = event.clientY - dragStartY;
                hbOffsetX += dx / model.scale.x;
                hbOffsetY += dy / model.scale.y;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                updateBoxPosition();
            } else if (isResizingBox) {
                const dx = event.clientX - dragStartX;
                const dy = event.clientY - dragStartY;
                hbWidth += (dx * 2) / model.scale.x;
                hbHeight += (dy * 2) / model.scale.y;
                
                hbWidth = Math.max(hbWidth, 100);
                hbHeight = Math.max(hbHeight, 100);
                
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                updateBoxPosition();
            }
        } else {
            if (isHeadpatSession) {
                isPatting = checkInBox(event.clientX, event.clientY);
            }

            if (isTrackingMouse && !isPlayingMotion && !isAdjustMode && !isHeadpatSession && !isCalibratingUI) {
                const headX = model.x;
                const headY = model.y - (model.height * eyeLevelOffset);
                const dx = lastMouseX - headX;
                const dy = lastMouseY - headY;
                let nx = dx / (window.innerWidth / 2);
                let ny = -(dy / (window.innerHeight / 2));
                nx = Math.max(-1, Math.min(1, nx));
                ny = Math.max(-1, Math.min(1, ny));
                if (model.internalModel && model.internalModel.focusController) {
                    model.internalModel.focusController.focus(nx, ny);
                }
            }
        }
    });

    app.view.addEventListener('wheel', (event) => {
        if (!isAdjustMode) return;
        event.preventDefault();
        const zoomAmount = 0.015;
        if (event.deltaY < 0) tempScale += zoomAmount;
        else tempScale -= zoomAmount;
        tempScale = Math.max(0.05, Math.min(tempScale, 2.0));
        applyTransform(tempScale, tempOffsetX, tempOffsetY);
    }, { passive: false });

    async function forceResetModel() {
        loadingScreen.classList.remove('hidden');
        updateProgress(0);
        if (!hasPlayedMotion) {
            isPlayingMotion = false;
            model.internalModel.motionManager.stopAllMotions();
            loadingScreen.classList.add('hidden');
            return;
        }
        isPlayingMotion = true;
        const targetY = model.y + 1000;
        const startY = model.y;
        for (let i = 0; i <= 20; i++) {
            model.y = startY + (targetY - startY) * (i / 20);
            await new Promise(r => setTimeout(r, 10));
        }
        app.stage.removeChild(model);
        model.destroy();
        model = await PIXI.live2d.Live2DModel.from(modelUrl, { onProgress: updateProgress });
        setupModel(model);
        model.y = targetY;
        app.stage.addChild(model);
        for (let i = 0; i <= 20; i++) {
            model.y = targetY - (targetY - startY) * (i / 20);
            await new Promise(r => setTimeout(r, 10));
        }
        hasPlayedMotion = false;
        isPlayingMotion = false;
        loadingScreen.classList.add('hidden');
    }

    const calibrateBtn = document.getElementById('calibrate-btn');
    const calibrationUI = document.getElementById('calibration-ui');
    const calibDoneBtn = document.getElementById('calib-done');
    const sidebar = document.getElementById('sidebar');
    const extraBtn = document.getElementById('extra-btn');

    calibrateBtn.addEventListener('click', () => {
        isCalibratingUI = true;
        sidebar.classList.remove('visible');
        extraBtn.classList.add('hidden');
        calibrationUI.classList.remove('hidden-fade');
        calibrationLine.classList.remove('hidden-fade');
        calibrationLine.style.top = `${model.y - (model.height * eyeLevelOffset)}px`;
        if (headHitbox) headHitbox.style.display = 'block';
        updateBoxPosition();
    });

    calibDoneBtn.addEventListener('click', () => {
        isCalibratingUI = false;
        localStorage.setItem('eyeLevelOffset', eyeLevelOffset);
        localStorage.setItem('headHitbox', JSON.stringify({ x: hbOffsetX, y: hbOffsetY, w: hbWidth, h: hbHeight }));
        calibrationUI.classList.add('hidden-fade');
        calibrationLine.classList.add('hidden-fade');
        sidebar.classList.add('visible');
        if (headHitbox) headHitbox.style.display = 'none';
    });

    const adjustBtn = document.getElementById('adjust-btn');
    const adjustUI = document.getElementById('adjust-ui');
    adjustBtn.addEventListener('click', () => {
        isAdjustMode = true;
        tempOffsetX = offsetX; tempOffsetY = offsetY; tempScale = baseScale;
        sidebar.classList.remove('visible');
        extraBtn.classList.add('hidden');
        adjustUI.classList.remove('hidden');
    });

    document.getElementById('adj-save').addEventListener('click', () => {
        isAdjustMode = false;
        offsetX = tempOffsetX; offsetY = tempOffsetY; baseScale = tempScale;
        localStorage.setItem('modelTransform', JSON.stringify({ offsetX, offsetY, scale: baseScale }));
        adjustUI.classList.add('hidden');
        sidebar.classList.add('visible');
    });

    document.getElementById('adj-cancel').addEventListener('click', () => {
        isAdjustMode = false;
        applyTransform(baseScale, offsetX, offsetY);
        adjustUI.classList.add('hidden');
        sidebar.classList.add('visible');
    });

    document.getElementById('adj-reset').addEventListener('click', () => {
        tempOffsetX = 350; tempOffsetY = 800; tempScale = 0.3;
        applyTransform(tempScale, tempOffsetX, tempOffsetY);
    });

    const expList = document.getElementById('exp-list');
    if (model.internalModel.settings.expressions) {
        model.internalModel.settings.expressions.forEach((exp, index) => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.textContent = exp.Name || `Expression ${index}`;
            btn.addEventListener('click', () => model.expression(index));
            expList.appendChild(btn);
        });
    }

    const motList = document.getElementById('mot-list');
    if (model.internalModel.settings.motions) {
        Object.keys(model.internalModel.settings.motions).forEach(group => {
            model.internalModel.settings.motions[group].forEach((motion, index) => {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                btn.textContent = motion.File.split('/').pop().replace('.motion3.json', '');
                btn.addEventListener('click', async () => {
                    if (hasPlayedMotion) await forceResetModel();
                    isPlayingMotion = true; hasPlayedMotion = true;
                    await model.motion(group, index);
                    isPlayingMotion = false;
                });
                motList.appendChild(btn);
            });
        });
    }

    document.getElementById('reset-btn').addEventListener('click', forceResetModel);
    const trackingToggle = document.getElementById('mouse-tracking-toggle');
    const savedTracking = localStorage.getItem('mouseTracking');
    if (savedTracking !== null) {
        isTrackingMouse = savedTracking === 'true';
        trackingToggle.checked = isTrackingMouse;
    }
    trackingToggle.addEventListener('change', (e) => {
        isTrackingMouse = e.target.checked;
        localStorage.setItem('mouseTracking', isTrackingMouse);
    });
}

initLive2D();

const extraBtn = document.getElementById('extra-btn');
const sidebar = document.getElementById('sidebar');
extraBtn.addEventListener('click', () => { extraBtn.classList.add('hidden'); sidebar.classList.add('visible'); });
document.getElementById('close-btn').addEventListener('click', () => { sidebar.classList.remove('visible'); extraBtn.classList.remove('hidden'); });

const darkModeToggle = document.getElementById('dark-mode-toggle');
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
}
darkModeToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

const bgUpload = document.getElementById('bg-upload');
const customBgBtn = document.getElementById('custom-bg-btn');
const bgFileInfo = document.getElementById('bg-file-info');
const bgFileName = document.getElementById('bg-file-name');

function updateBgUI(fileName) {
    customBgBtn.style.display = fileName ? 'none' : 'block';
    bgFileInfo.style.display = fileName ? 'flex' : 'none';
    bgFileName.textContent = fileName || '';
}

const savedBg = localStorage.getItem('customBg');
if (savedBg) {
    document.body.style.backgroundImage = `url(${savedBg})`;
    document.body.style.backgroundSize = 'cover';
    updateBgUI(localStorage.getItem('customBgName'));
}

customBgBtn.addEventListener('click', () => bgUpload.click());
bgUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.body.style.backgroundImage = `url(${ev.target.result})`;
            document.body.style.backgroundSize = 'cover';
            localStorage.setItem('customBg', ev.target.result);
            localStorage.setItem('customBgName', file.name);
            updateBgUI(file.name);
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('bg-remove-btn').addEventListener('click', () => {
    document.body.style.backgroundImage = 'none';
    localStorage.removeItem('customBg');
    localStorage.removeItem('customBgName');
    updateBgUI('');
});