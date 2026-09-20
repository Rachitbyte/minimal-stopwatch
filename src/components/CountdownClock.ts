export class CountdownClock {
  public el: HTMLElement;
  private timeText: HTMLElement;
  private progressRing: SVGCircleElement;
  private circumference: number;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'countdown-clock';
    this.el.style.display = 'none';

    // SVG Container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.setAttribute('class', 'clock-svg');

    // Inner Boundary
    const innerBoundary = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerBoundary.setAttribute('cx', '200');
    innerBoundary.setAttribute('cy', '200');
    innerBoundary.setAttribute('r', '178');
    innerBoundary.setAttribute('class', 'clock-inner-boundary');
    svg.appendChild(innerBoundary);

    // Clock Face Background
    const clockFace = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clockFace.setAttribute('cx', '200');
    clockFace.setAttribute('cy', '200');
    clockFace.setAttribute('r', '178');
    clockFace.setAttribute('class', 'clock-face-bg');
    svg.appendChild(clockFace);

    // SVG Numbers 1-12
    const numberRadius = 145;
    for (let i = 1; i <= 12; i++) {
      // 12 is at top (-90 degrees)
      const angleDeg = (i * 30) - 90;
      const angleRad = angleDeg * (Math.PI / 180);
      const x = 200 + numberRadius * Math.cos(angleRad);
      const y = 200 + numberRadius * Math.sin(angleRad);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x.toString());
      text.setAttribute('y', y.toString());
      text.setAttribute('class', 'clock-number');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = i.toString();
      svg.appendChild(text);
    }

    // Progress Base (subtle dark grey track)
    const progressBase = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressBase.setAttribute('cx', '200');
    progressBase.setAttribute('cy', '200');
    progressBase.setAttribute('r', '190');
    progressBase.setAttribute('class', 'clock-progress-base');
    svg.appendChild(progressBase);

    // Progress Active (blue)
    this.progressRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.progressRing.setAttribute('cx', '200');
    this.progressRing.setAttribute('cy', '200');
    this.progressRing.setAttribute('r', '190');
    this.progressRing.setAttribute('class', 'clock-progress-active');
    
    // Rotate to start at 12 o'clock (-90 degrees)
    this.progressRing.style.transform = 'rotate(-90deg)';
    this.progressRing.style.transformOrigin = '50% 50%';

    // Calculate circumference for stroke-dasharray
    this.circumference = 2 * Math.PI * 190;
    this.progressRing.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
    this.progressRing.style.strokeDashoffset = '0';
    svg.appendChild(this.progressRing);

    this.el.appendChild(svg);

    // Center Display (HTML overlay)
    const centerDisplay = document.createElement('div');
    centerDisplay.className = 'clock-center-display';

    this.timeText = document.createElement('div');
    this.timeText.className = 'clock-time-text';
    this.timeText.textContent = '00:00:00';

    const labelText = document.createElement('div');
    labelText.className = 'clock-label-text';
    labelText.textContent = 'REMAINING';

    centerDisplay.appendChild(this.timeText);
    centerDisplay.appendChild(labelText);
    
    this.el.appendChild(centerDisplay);

    container.appendChild(this.el);
  }

  public show() {
    this.el.style.display = 'flex';
  }

  public hide() {
    this.el.style.display = 'none';
    this.setPulse(false);
  }

  public setPulse(pulse: boolean) {
    if (pulse) {
      this.timeText.classList.add('pulse');
    } else {
      this.timeText.classList.remove('pulse');
    }
  }

  public update(remainingMs: number, totalMs: number) {
    // Math for time display
    const totalSec = Math.ceil(remainingMs / 1000); // ceil so it reaches 0 at exactly 0ms
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);

    const sStr = s.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    const hStr = h.toString().padStart(2, '0');
    
    // Always show HH:MM:SS as requested
    const timeString = `${hStr}:${mStr}:${sStr}`;

    this.timeText.textContent = timeString;

    // Math for SVG ring
    let progress = totalMs > 0 ? remainingMs / totalMs : 0;
    progress = Math.max(0, Math.min(1, progress));
    
    // SVG stroke-dashoffset: 0 is full, circumference is empty.
    const offset = this.circumference - (progress * this.circumference);
    this.progressRing.style.strokeDashoffset = offset.toString();
  }
}
