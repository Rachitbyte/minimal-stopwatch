const STRIP_VALUES = ['9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export class TimeDisplay {
  public el: HTMLElement;
  private strips: Record<string, { el: HTMLElement, currentIdx: number, val: string }> = {};
  private centisEl: HTMLElement;
  private lastTimeStr = '';
  private labelH: HTMLElement;
  private labelM: HTMLElement;
  private labelS: HTMLElement;
  private currentMode: 'stopwatch' | 'countdown' | 'clock' = 'stopwatch';

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'time-display idle';
    
    // HH:MM:SS
    this.createDigitGroup('h', 2);
    this.labelH = this.createLabel();
    this.createDigitGroup('m', 2);
    this.labelM = this.createLabel();
    this.createDigitGroup('s', 2);
    this.labelS = this.createLabel();
    
    // Centiseconds
    this.centisEl = document.createElement('div');
    this.centisEl.className = 'centis';
    this.centisEl.textContent = '.00';
    this.el.appendChild(this.centisEl);
    
    container.appendChild(this.el);
  }

  private createDigitGroup(prefix: string, count: number) {
    const group = document.createElement('div');
    group.className = `digit-group ${prefix}`;
    for (let i = count - 1; i >= 0; i--) {
      const digitContainer = document.createElement('div');
      digitContainer.className = `digit ${prefix}${i}`;
      
      const strip = document.createElement('div');
      strip.className = 'strip';
      
      for (const val of STRIP_VALUES) {
        const num = document.createElement('div');
        num.className = 'strip-num';
        num.textContent = val;
        strip.appendChild(num);
      }
      
      // Default to the first '0' which is at index 1
      strip.style.transform = `translateY(-1em)`;
      
      strip.addEventListener('transitionend', () => {
        const data = this.strips[`${prefix}${i}`];
        if (!data) return;
        if (data.currentIdx === 11) { // reached the end '0'
          strip.classList.add('no-transition');
          data.currentIdx = 1;
          strip.style.transform = `translateY(-1em)`;
          void strip.offsetHeight; // force reflow
          strip.classList.remove('no-transition');
        } else if (data.currentIdx === 0) { // reached the top '9'
          strip.classList.add('no-transition');
          data.currentIdx = 10;
          strip.style.transform = `translateY(-10em)`;
          void strip.offsetHeight;
          strip.classList.remove('no-transition');
        }
      });
      
      digitContainer.appendChild(strip);
      group.appendChild(digitContainer);
      this.strips[`${prefix}${i}`] = { el: strip, currentIdx: 1, val: '0' };
    }
    this.el.appendChild(group);
  }

  private createLabel() {
    const el = document.createElement('span');
    this.el.appendChild(el);
    return el;
  }

  public setDisplayMode(mode: 'stopwatch' | 'countdown' | 'clock') {
    this.currentMode = mode;
    const sGroup = this.el.querySelector('.digit-group.s') as HTMLElement;
    
    if (mode === 'clock') {
      this.labelH.className = 'time-label clock-colon'; this.labelH.innerHTML = ':';
      this.labelM.style.display = 'none';
      this.labelS.style.display = 'none';
      if (sGroup) sGroup.style.display = 'none';
    } else {
      this.labelH.className = 'time-label clock-colon'; this.labelH.innerHTML = ':';
      this.labelM.className = 'time-label clock-colon'; this.labelM.innerHTML = ':';
      this.labelM.style.display = 'inline-block';
      this.labelS.style.display = 'none';
      if (sGroup) sGroup.style.display = 'flex';
    }
  }

  public setIdle(idle: boolean) {
    this.el.classList.toggle('idle', idle);
  }

  public updateTime(ms: number) {
    const totalCenti = Math.floor(ms / 10);
    const centi = totalCenti % 100;
    const totalSec = Math.floor(ms / 1000);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60) % 60;
    let hr = Math.floor(totalSec / 3600);
    
    let ampm = '';
    if (this.currentMode === 'clock') {
      ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;
    }

    const hrStr = Math.min(hr, 99).toString().padStart(2, '0');
    const minStr = min.toString().padStart(2, '0');
    const secStr = sec.toString().padStart(2, '0');
    const fullStr = hrStr + minStr + secStr;

    if (this.lastTimeStr !== fullStr) {
      this.updateDigit('h1', fullStr[0]);
      this.updateDigit('h0', fullStr[1]);
      this.updateDigit('m1', fullStr[2]);
      this.updateDigit('m0', fullStr[3]);
      this.updateDigit('s1', fullStr[4]);
      this.updateDigit('s0', fullStr[5]);
      this.lastTimeStr = fullStr;
    }

    if (this.currentMode === 'clock') {
      this.centisEl.innerHTML = `.${secStr} <span class="ampm-text">${ampm}</span>`;
    } else {
      this.centisEl.textContent = `.${centi.toString().padStart(2, '0')}`;
    }
  }
  
  public resetInstant() {
    this.lastTimeStr = '';
    for (const key in this.strips) {
      const data = this.strips[key];
      data.el.classList.add('no-transition');
      data.currentIdx = 1;
      data.val = '0';
      data.el.style.transform = `translateY(-1em)`;
      void data.el.offsetHeight;
      data.el.classList.remove('no-transition');
    }
    this.centisEl.textContent = '.00';
    this.setIdle(true);
  }

  private updateDigit(key: string, targetVal: string) {
    const data = this.strips[key];
    if (!data || data.val === targetVal) return;
    
    const targetNum = parseInt(targetVal);
    const currentNum = parseInt(data.val);
    
    if (targetNum === (currentNum + 1) % 10) {
      data.currentIdx++;
    } else if (currentNum === (targetNum + 1) % 10) {
      data.currentIdx--;
    } else {
      data.el.classList.add('no-transition');
      data.currentIdx = targetNum === 9 ? 10 : targetNum + 1;
      data.el.style.transform = `translateY(-${data.currentIdx}em)`;
      void data.el.offsetHeight;
      data.el.classList.remove('no-transition');
    }
    
    data.val = targetVal;
    data.el.style.transform = `translateY(-${data.currentIdx}em)`;
  }
}
