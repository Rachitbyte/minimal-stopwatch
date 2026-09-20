export class CountdownInput {
  private el: HTMLElement;
  private pickerWrapper: HTMLElement;
  private pickerContainer: HTMLElement;
  
  private durationMs: number = 0;
  
  public onDurationChange: (ms: number) => void = () => {};

  constructor(container: HTMLElement, initialDurationMs: number) {
    this.durationMs = initialDurationMs;
    
    this.el = document.createElement('div');
    this.el.className = 'countdown-input-container';
    
    this.pickerWrapper = document.createElement('div');
    this.pickerWrapper.className = 'picker-wrapper';
    
    
    this.pickerContainer = document.createElement('div');
    this.pickerContainer.className = 'picker-container';
    
    const selectionFrame = document.createElement('div');
    selectionFrame.className = 'picker-selection-frame';
    this.pickerContainer.appendChild(selectionFrame);
    
    this.pickerWrapper.appendChild(this.pickerContainer);
    const unitsOverlay = document.createElement('div');
    unitsOverlay.className = 'picker-units-overlay';
    unitsOverlay.innerHTML = `<div><span>H</span></div><div><span>M</span></div><div><span>S</span></div>`;
    this.pickerContainer.appendChild(unitsOverlay);
    
    this.el.appendChild(this.pickerWrapper);
    
    this.buildPicker();
    
    container.appendChild(this.el);
    
    // Sync initial state after a brief timeout to let DOM settle for scroll positions
    setTimeout(() => {
      this.syncPickerToDuration();
    }, 0);
  }

  public show() {
    this.el.style.display = 'flex';
    // Force sync when becoming visible to override browser scroll restoration
    this.syncPickerToDuration();
  }

  public hide() {
    this.el.style.display = 'none';
  }

  private buildPicker() {
    const createColumn = (max: number, type: 'h' | 'm' | 's') => {
      const col = document.createElement('div');
      col.className = `picker-column ${type}-col`;
      col.innerHTML = '<div class="picker-spacer"></div>';
      
      // Ghost items above
      for (let i = max - 2; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'picker-item ghost';
        item.textContent = i.toString().padStart(2, '0');
        col.appendChild(item);
      }

      // Real items
      for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.textContent = i.toString().padStart(2, '0');
        col.appendChild(item);
      }
      
      // Ghost items below
      for (let i = 0; i <= 2; i++) {
        const item = document.createElement('div');
        item.className = 'picker-item ghost';
        item.textContent = i.toString().padStart(2, '0');
        col.appendChild(item);
      }
      
      col.innerHTML += '<div class="picker-spacer"></div>';
      
      let scrollTimeout: any;
      let ticking = false;
      col.addEventListener('scroll', () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            this.apply3DEffect(col);
            ticking = false;
          });
          ticking = true;
        }
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.calculatePickerDuration();
          
          // Infinite scroll wrap-around jump
          const idx = Math.round(col.scrollTop / 50);
          if (idx < 3) {
            col.scrollTop = (idx + max + 1) * 50;
          } else if (idx > 3 + max) {
            col.scrollTop = (idx - max - 1) * 50;
          }
        }, 150);
      });
      
      // Apply initial 3D effect
      setTimeout(() => this.apply3DEffect(col), 0);
      return col;
    };

    this.pickerContainer.appendChild(createColumn(99, 'h'));
    this.pickerContainer.appendChild(createColumn(59, 'm'));
    this.pickerContainer.appendChild(createColumn(59, 's'));
  }

  private calculatePickerDuration() {
    const getVal = (type: string, max: number) => {
      const col = this.pickerContainer.querySelector(`.${type}-col`) as HTMLElement;
      if (!col) return 0;
      const idx = Math.round(col.scrollTop / 50);
      if (idx < 3) return max - (2 - idx);
      if (idx > 3 + max) return idx - (3 + max) - 1;
      return idx - 3;
    };
    const h = getVal('h', 99);
    const m = getVal('m', 59);
    const s = getVal('s', 59);
    
    this.durationMs = (h * 3600 + m * 60 + s) * 1000;
    this.onDurationChange(this.durationMs);
  }

  private syncPickerToDuration() {
    const totalSec = Math.floor(this.durationMs / 1000);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);

    const setVal = (type: string, val: number) => {
      const col = this.pickerContainer.querySelector(`.${type}-col`) as HTMLElement;
      if (col) {
        col.scrollTop = (val + 3) * 50;
        this.apply3DEffect(col);
      }
    };
    setVal('h', h);
    setVal('m', m);
    setVal('s', s);
  }

  private apply3DEffect(col: HTMLElement) {
    const scrollTop = col.scrollTop;
    const items = col.querySelectorAll('.picker-item') as NodeListOf<HTMLElement>;
    
    items.forEach((item, i) => {
      const diff = (i * 50) - scrollTop;
      
      // Mathematically perfect cylinder mapping
      const absDiff = Math.abs(diff);
      const R = 110; // Cylinder radius
      
      // Clamp angle to prevent wrapping around the cylinder completely
      const thetaDeg = Math.max(-85, Math.min(85, (diff / 50) * 20));
      const thetaRad = thetaDeg * (Math.PI / 180);
      
      const expectedY = R * Math.sin(thetaRad);
      const translateY = expectedY - diff;
      
      const scale = Math.max(0.2, 1 - absDiff / 800); // Subtle shrink, prevent negative scale
      
      // Fade out items as they wrap around the cylinder
      const opacity = Math.max(0, 1 - (absDiff / 170));
      
      item.style.transform = `translateY(${translateY}px) scale(${scale}) rotateX(${thetaDeg}deg)`;
      item.style.opacity = opacity.toString();
      item.style.visibility = opacity === 0 ? 'hidden' : 'visible';
      
      // Highlight the center item
      if (absDiff < 25) {
        item.style.color = 'var(--color-text-primary)';
      } else {
        item.style.color = 'var(--color-text-secondary)';
      }
    });
  }
}
