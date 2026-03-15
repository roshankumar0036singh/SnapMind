export class SelectionOverlay {
    constructor() {
        this.overlay = null;
        this.selectionBox = null;
        this.instructions = null; // New: Instruction badge
        this.toolbar = null;      // New: Action toolbar
        this.startX = 0;
        this.startY = 0;
        this.isSelecting = false;
        this.isLocked = false;    // New: Lock selection when toolbar is shown
        this.resolveSelection = null;
    }

    start() {
        return new Promise((resolve) => {
            this.resolveSelection = resolve;

            // 1. Create Overlay
            this.overlay = document.createElement('div');
            Object.assign(this.overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                zIndex: '2147483647',
                cursor: 'crosshair',
                backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly darker
                userSelect: 'none'
            });

            // 2. Instructions Badge
            this.instructions = document.createElement('div');
            this.instructions.textContent = "Drag to select area. Press ESC to cancel.";
            Object.assign(this.instructions.style, {
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#1f2937', // Slate-800
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'sans-serif',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                pointerEvents: 'none',
                zIndex: '2147483648'
            });
            this.overlay.appendChild(this.instructions);

            // 3. Selection Box
            this.selectionBox = document.createElement('div');
            Object.assign(this.selectionBox.style, {
                position: 'fixed',
                border: '2px solid #6366f1', // Indigo-500
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.2)', // Focus effect
                display: 'none',
                zIndex: '2147483648'
            });
            this.overlay.appendChild(this.selectionBox);

            // 4. Bind Events
            this.onMouseDown = this.onMouseDown.bind(this);
            this.onMouseMove = this.onMouseMove.bind(this);
            this.onMouseUp = this.onMouseUp.bind(this);
            this.onKeyDown = this.onKeyDown.bind(this);

            this.overlay.addEventListener('mousedown', this.onMouseDown);
            document.addEventListener('mousemove', this.onMouseMove); // Global move
            document.addEventListener('mouseup', this.onMouseUp);     // Global up
            document.addEventListener('keydown', this.onKeyDown);

            document.body.appendChild(this.overlay);
        });
    }

    cleanup() {
        if (this.overlay) this.overlay.remove();
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('keydown', this.onKeyDown);

        this.overlay = null;
        this.selectionBox = null;
        this.instructions = null;
        this.toolbar = null;
        this.isSelecting = false;
        this.isLocked = false;
    }

    createToolbar(rect) {
        if (this.toolbar) this.toolbar.remove();

        this.toolbar = document.createElement('div');
        Object.assign(this.toolbar.style, {
            position: 'absolute',
            left: '0px', // Relative to box
            top: '100%',
            marginTop: '8px',
            display: 'flex',
            gap: '8px',
            pointerEvents: 'auto'
        });

        const createBtn = (text, color, onClick) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            Object.assign(btn.style, {
                backgroundColor: color,
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: 'sans-serif',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            });
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevent overlay click
                onClick();
            };
            return btn;
        };

        const confirmBtn = createBtn('Analyze', '#10b981', () => this.confirmSelection()); // Emerald-500
        const cancelBtn = createBtn('Cancel', '#ef4444', () => this.cleanupAndResolve(null)); // Red-500

        this.toolbar.appendChild(confirmBtn);
        this.toolbar.appendChild(cancelBtn);
        this.selectionBox.appendChild(this.toolbar); // Attach to box so it moves with it
    }

    confirmSelection() {
        const rect = this.selectionBox.getBoundingClientRect();
        // Send cleanup first, then value
        const result = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
        };
        this.cleanupAndResolve(result);
    }

    cleanupAndResolve(result) {
        this.cleanup();
        if (this.resolveSelection) this.resolveSelection(result);
    }

    onMouseDown(e) {
        // If clicking toolbar, do nothing
        if (e.target.tagName === 'BUTTON') return;
        // If locked (toolbar shown), clicking outside resets selection
        if (this.isLocked) {
            this.isLocked = false;
            // Remove toolbar
            if (this.toolbar) {
                this.toolbar.remove();
                this.toolbar = null;
            }
            // Start new selection immediately
            this.isSelecting = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.updateBox(this.startX, this.startY, 0, 0);
            return;
        }

        this.isSelecting = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.updateBox(this.startX, this.startY, 0, 0);
    }

    onMouseMove(e) {
        if (!this.isSelecting) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);
        const left = Math.min(currentX, this.startX);
        const top = Math.min(currentY, this.startY);

        this.updateBox(left, top, width, height);
    }

    updateBox(left, top, width, height) {
        Object.assign(this.selectionBox.style, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
            display: 'block'
        });
    }

    onMouseUp(e) {
        if (!this.isSelecting) return;
        this.isSelecting = false;

        const rect = this.selectionBox.getBoundingClientRect();

        // If too small, treat as a "Cancel" click or ignore
        if (rect.width < 10 || rect.height < 10) {
            Object.assign(this.selectionBox.style, { display: 'none' });
            return;
        }

        // Lock and show toolbar
        this.isLocked = true;
        this.createToolbar(rect);
    }

    onKeyDown(e) {
        if (e.key === 'Escape') {
            this.cleanupAndResolve(null);
        }
    }
}
