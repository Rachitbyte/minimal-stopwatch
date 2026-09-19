export class CountdownInput {
  private el: HTMLElement;
  private currentStyle: 'picker' | 'typed';
  private pickerWrapper: HTMLElement;
  private pickerContainer: HTMLElement;
  private typedContainer: HTMLElement;
  private toggleBtn: HTMLElement;
  
  private typedDigits: string = '';
  private durationMs: number = 0;
  
  public onDurationChange: (ms: number) => void = () => {};
  public onStyleChange: (style: 'picker' | 'typed') => void = () => {};

  constructor(container: HTMLElement, initialStyle: 'picker' | 'typed', initialDurationMs: number) {
    this.currentStyle = initialStyle;
    this.durationMs = initialDurationMs;
    
    this.el = document.createElement('div');
    this.el.className = 'countdown-input-container';
    
    this.pickerWrapper = document.createElement('div');
    this.pickerWrapper.className = 'picker-wrapper';
    
    const pickerLabels = document.createElement('div');
    pickerLabels.className = 'picker-labels';
    pickerLabels.innerHTML = `<div>hr</div><div>min</div><div>sec</div>`;
    
    this.pickerContainer = document.createElement('div');
    this.pickerContainer.className = 'picker-container';
    
    const selectionFrame = document.createElement('div');
    selectionFrame.className = 'picker-selection-frame';
    this.pickerContainer.appendChild(selectionFrame);
    
    this.pickerWrapper.appendChild(pickerLabels);
    this.pickerWrapper.appendChild(this.pickerContainer);
    
    this.typedContainer = document.createElement('div');
    this.typedContainer.className = 'typed-input';
    
    this.toggleBtn = document.createElement('div');
    this.toggleBtn.className = 'toggle-input-style';
    this.toggleBtn.textContent = 'Switch to ' + (initialStyle === 'picker' ? 'Keyboard' : 'Scroll');
    
    this.el.appendChild(this.pickerWrapper);
    this.el.appendChild(this.typedContainer);
    this.el.appendChild(this.toggleBtn);
    
    this.buildPicker();
    this.updateVisibility();
    this.updateTypedDisplay();
    
    this.toggleBtn.addEventListener('click', () => {
      this.currentStyle = this.currentStyle === 'picker' ? 'typed' : 'picker';
      this.toggleBtn.textContent = 'Switch to ' + (this.currentStyle === 'picker' ? 'Keyboard' : 'Scroll');
      this.updateVisibility();
      this.onStyleChange(this.currentStyle);
      
      if (this.currentStyle === 'picker') {
        this.syncPickerToDuration();
      } else {
        this.syncTypedToDuration();
      }
    });

    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    container.appendChild(this.el);
    
    // Sync initial state after a brief timeout to let DOM settle for scroll positions
    setTimeout(() => {
      if (this.currentStyle === 'picker') this.syncPickerToDuration();
      else this.syncTypedToDuration();
    }, 0);
  }

  public show() {
    this.el.style.display = 'flex';
  }

  public hide() {
    this.el.style.display = 'none';
  }

  private updateVisibility() {
    this.pickerWrapper.style.display = this.currentStyle === 'picker' ? 'flex' : 'none';
    this.typedContainer.style.display = this.currentStyle === 'typed' ? 'block' : 'none';
  }

  private buildPicker() {
    const createColumn = (max: number, type: 'h' | 'm' | 's') => {
      const col = document.createElement('div');
      col.className = `picker-column ${type}-col`;
      col.innerHTML = '<div class="picker-spacer"></div>';
      for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.textContent = i.toString().padStart(2, '0');
        col.appendChild(item);
      }
      col.innerHTML += '<div class="picker-spacer"></div>';
      
      let scrollTimeout: any;
      col.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.calculatePickerDuration();
        }, 100);
      });
      return col;
    };

    this.pickerContainer.appendChild(createColumn(99, 'h'));
    this.pickerContainer.appendChild(createColumn(59, 'm'));
    this.pickerContainer.appendChild(createColumn(59, 's'));
  }

  private calculatePickerDuration() {
    const getVal = (type: string) => {
      const col = this.pickerContainer.querySelector(`.${type}-col`) as HTMLElement;
      if (!col) return 0;
      const idx = Math.round(col.scrollTop / 50);
      return idx;
    };
    const h = getVal('h');
    const m = getVal('m');
    const s = getVal('s');
    
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
        col.scrollTop = val * 50;
      }
    };
    setVal('h', h);
    setVal('m', m);
    setVal('s', s);
  }

  private syncTypedToDuration() {
    const totalSec = Math.floor(this.durationMs / 1000);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);
    
    const str = h.toString().padStart(2, '0') + m.toString().padStart(2, '0') + s.toString().padStart(2, '0');
    // Strip leading zeros
    this.typedDigits = str.replace(/^0+/, '');
    this.updateTypedDisplay();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.el.style.display === 'none' || this.currentStyle !== 'typed') return;
    
    if (e.key >= '0' && e.key <= '9') {
      if (this.typedDigits.length < 6) {
        this.typedDigits += e.key;
        // remove leading zeros
        this.typedDigits = this.typedDigits.replace(/^0+/, '');
      }
    } else if (e.key === 'Backspace') {
      this.typedDigits = this.typedDigits.slice(0, -1);
    } else {
      return;
    }
    
    const padded = this.typedDigits.padStart(6, '0');
    const h = parseInt(padded.slice(0, 2), 10);
    const m = parseInt(padded.slice(2, 4), 10);
    const s = parseInt(padded.slice(4, 6), 10);
    
    this.durationMs = (h * 3600 + m * 60 + s) * 1000;
    this.onDurationChange(this.durationMs);
    this.updateTypedDisplay();
  }

  private updateTypedDisplay() {
    const padded = this.typedDigits.padStart(6, '0');
    const h = padded.slice(0, 2);
    const m = padded.slice(2, 4);
    const s = padded.slice(4, 6);
    this.typedContainer.innerHTML = `${h}<span>h</span>${m}<span>m</span>${s}<span>s</span>`;
  }
}
