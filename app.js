window.PIXI = PIXI;

async function initLive2D() {
    const app = new PIXI.Application({
        view: document.getElementById('live2d-canvas'),
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: window
    });

    let modelUrl = './model/huohuo.model3.json';
    let model = await PIXI.live2d.Live2DModel.from(modelUrl);
    app.stage.addChild(model);

    let offsetX = 350;
    let offsetY = 800;
    let baseScale = 0.3;
    let eyeLevelOffset = 0.25;

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
    if (savedEyeLevel) {
        eyeLevelOffset = parseFloat(savedEyeLevel);
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

    window.addEventListener('resize', () => {
        if (isAdjustMode) {
            applyTransform(tempScale, tempOffsetX, tempOffsetY);
        } else {
            applyTransform(baseScale, offsetX, offsetY);
        }
    });

    app.view.addEventListener('mousedown', (e) => {
        if (!isAdjustMode) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
    });

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
        if (isAdjustMode) isDragging = false;
        if (isCalibratingUI) isDraggingLine = false;
    });

    window.addEventListener('mousemove', (event) => {
        if (isAdjustMode && isDragging) {
            const dx = event.clientX - dragStartX;
            const dy = event.clientY - dragStartY;
            tempOffsetX += dx;
            tempOffsetY += dy;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            applyTransform(tempScale, tempOffsetX, tempOffsetY);
        } else {
            if (isCalibratingUI && isDraggingLine) {
                let newLineY = event.clientY;
                calibrationLine.style.top = `${newLineY}px`;
                eyeLevelOffset = (model.y - newLineY) / model.height;
            }

            if (isTrackingMouse && !isPlayingMotion && !isAdjustMode) {
                const rect = app.view.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;
                
                const headX = model.x;
                const headY = model.y - (model.height * eyeLevelOffset);
                
                const dx = mouseX - headX;
                const dy = mouseY - headY;
                
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
        if (event.deltaY < 0) {
            tempScale += zoomAmount;
        } else {
            tempScale -= zoomAmount;
        }
        tempScale = Math.max(0.05, Math.min(tempScale, 2.0));
        applyTransform(tempScale, tempOffsetX, tempOffsetY);
    }, { passive: false });

    function resetFocus() {
        if (model.internalModel && model.internalModel.focusController) {
            model.internalModel.focusController.focus(0, 0);
        }
    }

    async function forceResetModel() {
        if (!hasPlayedMotion) {
            isPlayingMotion = false;
            resetFocus();
            model.internalModel.motionManager.stopAllMotions();
            if (model.internalModel.motionManager.expressionManager) {
                model.internalModel.motionManager.expressionManager.resetExpression();
            }
            const core = model.internalModel.coreModel;
            if (core.getParameterCount && core.getParameterDefaultValues) {
                const count = core.getParameterCount();
                const defaults = core.getParameterDefaultValues();
                for (let i = 0; i < count; i++) {
                    core.setParameterValueByIndex(i, defaults[i]);
                }
            }
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
        
        model = await PIXI.live2d.Live2DModel.from(modelUrl);
        setupModel(model);
        model.y = targetY;
        app.stage.addChild(model);

        for (let i = 0; i <= 20; i++) {
            model.y = targetY - (targetY - startY) * (i / 20);
            await new Promise(r => setTimeout(r, 10));
        }

        hasPlayedMotion = false;
        isPlayingMotion = false;
    }

    document.documentElement.addEventListener('mouseleave', resetFocus);
    window.addEventListener('blur', resetFocus);

    const savedTracking = localStorage.getItem('mouseTracking');
    const trackingToggle = document.getElementById('mouse-tracking-toggle');
    if (savedTracking !== null) {
        isTrackingMouse = savedTracking === 'true';
        if (trackingToggle) trackingToggle.checked = isTrackingMouse;
    }

    if (trackingToggle) {
        trackingToggle.addEventListener('change', (event) => {
            isTrackingMouse = event.target.checked;
            localStorage.setItem('mouseTracking', isTrackingMouse);
            if (!isTrackingMouse) resetFocus();
        });
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', forceResetModel);
    }

    const adjustBtn = document.getElementById('adjust-btn');
    const adjustUI = document.getElementById('adjust-ui');
    const adjSave = document.getElementById('adj-save');
    const adjCancel = document.getElementById('adj-cancel');
    const adjReset = document.getElementById('adj-reset');
    const extraBtn = document.getElementById('extra-btn');
    const sidebar = document.getElementById('sidebar');

    const calibrateBtn = document.getElementById('calibrate-btn');
    const calibrationUI = document.getElementById('calibration-ui');
    const calibDoneBtn = document.getElementById('calib-done');

    if (calibrateBtn) {
        calibrateBtn.addEventListener('click', () => {
            isCalibratingUI = true;
            sidebar.classList.remove('visible');
            extraBtn.classList.add('hidden');
            calibrationUI.classList.remove('hidden-top');
            calibrationLine.classList.remove('hidden-fade');

            const startLineY = model.y - (model.height * eyeLevelOffset);
            calibrationLine.style.top = `${startLineY}px`;
        });
    }

    if (calibDoneBtn) {
        calibDoneBtn.addEventListener('click', () => {
            isCalibratingUI = false;
            localStorage.setItem('eyeLevelOffset', eyeLevelOffset);
            calibrationUI.classList.add('hidden-top');
            calibrationLine.classList.add('hidden-fade');
            sidebar.classList.add('visible');
        });
    }

    if (adjustBtn) {
        adjustBtn.addEventListener('click', () => {
            isAdjustMode = true;
            tempOffsetX = offsetX;
            tempOffsetY = offsetY;
            tempScale = baseScale;
            
            sidebar.classList.remove('visible');
            extraBtn.classList.add('hidden');
            adjustUI.classList.remove('hidden');
        });
    }

    if (adjSave) {
        adjSave.addEventListener('click', () => {
            isAdjustMode = false;
            offsetX = tempOffsetX;
            offsetY = tempOffsetY;
            baseScale = tempScale;
            localStorage.setItem('modelTransform', JSON.stringify({
                offsetX: offsetX,
                offsetY: offsetY,
                scale: baseScale
            }));
            
            adjustUI.classList.add('hidden');
            sidebar.classList.add('visible');
        });
    }

    if (adjCancel) {
        adjCancel.addEventListener('click', () => {
            isAdjustMode = false;
            applyTransform(baseScale, offsetX, offsetY);
            
            adjustUI.classList.add('hidden');
            sidebar.classList.add('visible');
        });
    }

    if (adjReset) {
        adjReset.addEventListener('click', () => {
            tempOffsetX = 350;
            tempOffsetY = 800;
            tempScale = 0.3;
            applyTransform(tempScale, tempOffsetX, tempOffsetY);
        });
    }

    const expList = document.getElementById('exp-list');
    if (model.internalModel.settings.expressions) {
        model.internalModel.settings.expressions.forEach((exp, index) => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.textContent = exp.Name || `Expression ${index}`;
            btn.addEventListener('click', () => {
                model.expression(index);
            });
            expList.appendChild(btn);
        });
    }

    const motList = document.getElementById('mot-list');
    if (model.internalModel.settings.motions) {
        Object.keys(model.internalModel.settings.motions).forEach(group => {
            model.internalModel.settings.motions[group].forEach((motion, index) => {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                let motionName = motion.File.split('/').pop().replace('.motion3.json', '');
                btn.textContent = motionName;

                btn.addEventListener('click', async () => {
                    if (hasPlayedMotion) {
                        await forceResetModel();
                    }
                    isPlayingMotion = true;
                    hasPlayedMotion = true;
                    resetFocus();
                    await model.motion(group, index);
                    isPlayingMotion = false;
                });
                motList.appendChild(btn);
            });
        });
    }
}

initLive2D();

const extraBtn = document.getElementById('extra-btn');
const sidebar = document.getElementById('sidebar');
const closeBtn = document.getElementById('close-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');

const bgUpload = document.getElementById('bg-upload');
const customBgBtn = document.getElementById('custom-bg-btn');
const bgFileInfo = document.getElementById('bg-file-info');
const bgFileName = document.getElementById('bg-file-name');
const bgRemoveBtn = document.getElementById('bg-remove-btn');

function updateBgUI(fileName) {
    if (fileName) {
        customBgBtn.style.display = 'none';
        bgFileInfo.style.display = 'flex';
        bgFileName.textContent = fileName;
    } else {
        customBgBtn.style.display = 'block';
        bgFileInfo.style.display = 'none';
        bgFileName.textContent = '';
    }
}

extraBtn.addEventListener('click', () => {
    extraBtn.classList.add('hidden');
    sidebar.classList.add('visible');
});

closeBtn.addEventListener('click', () => {
    sidebar.classList.remove('visible');
    extraBtn.classList.remove('hidden');
});

const savedDarkMode = localStorage.getItem('darkMode');
if (savedDarkMode === 'true') {
    document.body.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
}

if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (event) => {
        const isDark = event.target.checked;
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('darkMode', isDark);
    });
}

const savedBg = localStorage.getItem('customBg');
const savedBgName = localStorage.getItem('customBgName') || 'Saved Background';
if (savedBg) {
    document.body.style.backgroundImage = `url(${savedBg})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    updateBgUI(savedBgName);
}

if (customBgBtn && bgUpload) {
    customBgBtn.addEventListener('click', () => {
        bgUpload.click();
    });
}

if (bgUpload) {
    bgUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Img = e.target.result;
                document.body.style.backgroundImage = `url(${base64Img})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
                try {
                    localStorage.setItem('customBg', base64Img);
                    localStorage.setItem('customBgName', file.name);
                    updateBgUI(file.name);
                } catch (err) {
                    console.warn('Image is too massive for local storage bro!');
                    updateBgUI(file.name);
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

if (bgRemoveBtn) {
    bgRemoveBtn.addEventListener('click', () => {
        document.body.style.backgroundImage = 'none';
        localStorage.removeItem('customBg');
        localStorage.removeItem('customBgName');
        bgUpload.value = '';
        updateBgUI('');
    });
}