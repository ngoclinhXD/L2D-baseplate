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

    const yOffset = 800; 
    const xOffset = 200;
    let isTrackingMouse = true;
    let isPlayingMotion = false;
    let hasPlayedMotion = false;

    function setupModel(m) {
        m.scale.set(0.3); 
        m.anchor.set(0.5, 0.5);
        m.x = (app.renderer.width / 2) + xOffset;
        m.y = (app.renderer.height / 2) + yOffset;
    }

    setupModel(model);

    window.addEventListener('resize', () => {
        model.x = (app.renderer.width / 2) + xOffset;
        model.y = (app.renderer.height / 2) + yOffset;
    });

    window.addEventListener('mousemove', (event) => {
        if (isTrackingMouse && !isPlayingMotion) {
            const rect = app.view.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            model.focus(x + xOffset, y + yOffset);
        }
    });

    function resetFocus() {
        model.internalModel.focusController.focus(0, 0);
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

    const trackingToggle = document.getElementById('mouse-tracking-toggle');
    if (trackingToggle) {
        trackingToggle.addEventListener('change', (event) => {
            isTrackingMouse = event.target.checked;
            if (!isTrackingMouse) resetFocus();
        });
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', forceResetModel);
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

extraBtn.addEventListener('click', () => {
    extraBtn.classList.add('hidden');
    sidebar.classList.add('visible');
});

closeBtn.addEventListener('click', () => {
    sidebar.classList.remove('visible');
    extraBtn.classList.remove('hidden');
});

if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (event) => {
        if (event.target.checked) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    });
}