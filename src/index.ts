type Direction =  'up' | 'left' | 'right' | 'down';

interface Point {
  x: number;
  y: number;
}

interface Pixel extends Point {
  element: HTMLDivElement;
}
export class SnakeGame {

  private readonly element: HTMLDivElement;

  private readonly backgroundWindowColour = 'black';
  private readonly snakeColour = 'rgb(32, 247, 90)';
  private readonly borderWindowColour = 'rgb(189, 188, 194)';
  private readonly foodColour = 'rgb(59, 137, 255)';

  private readonly speed = 100;
  private readonly width = 300;
  private readonly height = 300;
  private readonly verticalPixels = 20;
  private readonly horizontalPixels = 20;

  private readonly lidcerStyle = 'snake-game-lidcer-style';
  private readonly gameWindowClass = 'snake-game-lidcer';
  private readonly snakeBodyClass = 'sbc-lidcer';
  private readonly foodClass = 'igf-lidcer';

  private snake: Pixel[] = [];
  private snakeLastState: Point[] = [];
  private food: Pixel;
  private now = performance.now();
  private direction: Direction = 'up';
  private timeToUpdate = 0;
  private pause = false;
  private ignoreBorders = true;
  private lastTouch?: Point;
  private moveTouch?: Point;
  private warn = 0;
  private destroyed = false;

  constructor() {
    this.createOrRewriteStyle();
    this.element = document.createElement('div');
    this.element.classList.add(this.gameWindowClass);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeypress);
    window.addEventListener('touchstart', this.touchStart);
    window.addEventListener('touchmove', this.touchMove);
    window.addEventListener('touchend', this.touchEnd);

    document.body.append(this.element);
    this.onResize();

    this.snake.push(this.createSnakePixel());
    this.generateRandomFood();
    this.drawSnake();
    this.gameLoop();
  }
  private createOrRewriteStyle() {
    const boxAnimationTime = 0.1;
    const s = document.getElementById(this.lidcerStyle);
    const style = s ? s : document.createElement('style');
    style.id = this.lidcerStyle;
    const transitionTime = 0.15;
    const styleText = [
      `.${this.snakeBodyClass} {`,
      `   background-color: ${this.snakeColour};`,
      `${this.ignoreBorders ? '' : `   transition: top ${transitionTime}s ease 0s, left ${transitionTime}s ease 0s;`}`,
      `   position: fixed;`,
      `}`,

      `.${this.gameWindowClass} {`,
      `   position: fixed;`,
      `   z-index: 9999999;`,
      `   transition: top ${boxAnimationTime}s ease 0s, left ${boxAnimationTime}s ease 0s;`,
      `   background-color: ${this.backgroundWindowColour};`,
      `   border: 2px ${this.ignoreBorders ? 'dashed' : 'solid' } ${this.borderWindowColour};`,
      `   width: ${this.width}px;`,
      `   height: ${this.height}px;`,
      `}`,

      `.${this.foodClass} {`,
      `   position: fixed;`,
      `   background-color: ${this.foodColour};`,
      `   z-index: 999999999;`,
      `}`,

    ].join('\n');
    style.textContent = styleText;
    if (!s) {
      document.head.append(style);
    }
  }

  private touchStart = (ev: TouchEvent) => {
    if (this.element.contains(ev.target as Node) || this.element === ev.target) {
      if (!document.querySelector('#snake-enforce')) {
        const meta = document.createElement('meta');
        meta.id = 'snake-enforce';
        meta.setAttribute('name', 'mobile-web-app-capable');
        meta.setAttribute('content', 'yes');
        document.head.append(meta);
      }
      document.body.style.overflow = 'hidden';
      document.body.style['overscrollBehavior'] = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style['overscrollBehavior'] = '';
    }
    if (!ev.touches[0]) return;
    const x = ev.touches[0].clientX;
    const y = ev.touches[0].clientY;
    this.lastTouch = {x, y};
    this.onResize();
  }
  touchMove = (ev: TouchEvent) => {
    if (!ev.touches[0]) return;
    const x = ev.touches[0].clientX;
    const y = ev.touches[0].clientY;
    this.moveTouch = { x, y};
    this.onResize();
  }

  private touchEnd = () => {
    if (this.lastTouch && this.moveTouch) {
      const horizontal = Math.abs(this.lastTouch.x - this.moveTouch.x) > Math.abs(this.lastTouch.y - this.moveTouch.y);

      if (horizontal && this.lastTouch.x > this.moveTouch.x) {
        this.direction = 'left';
      } else if (horizontal && this.lastTouch.x < this.moveTouch.x) {
        this.direction = 'right';
      } else if (this.lastTouch.y < this.moveTouch.y) {
        this.direction = 'down';
      } else if (this.lastTouch.y > this.moveTouch.y) {
        this.direction = 'up';
      }
    } else {
      this.resetGame();
    }
    this.lastTouch = undefined;
    this.moveTouch = undefined;
    this.onResize();
  }

  private gameLoop = () => {
    if (this.destroyed) return;
    const now = performance.now();
    const delta = now - this.now;
    this.now = now;
    if (delta > 20) {
      if (this.warn === 50) console.warn('You game is running slow. Close the console to increase the performance');
      this.warn++;
    }

    if (this.pause) return  requestAnimationFrame(this.gameLoop);
    this.timeToUpdate += delta;
    if (this.timeToUpdate > this.speed) {
      this.storeLastState();
      this.updateSnakePos();
      this.drawSnake();
      this.fixFood();
      this.timeToUpdate = 0;
    }
    requestAnimationFrame(this.gameLoop);
  }

  private updateSnakePos() {
    const length = this.snake.length;
    const lastSnakePixel = {x : this.snake[length - 1].x, y: this.snake[length - 1].y};
    if (this.direction === 'up') {
      this.snake[0].y--;
    } else if (this.direction === 'down') {
      this.snake[0].y++;
    } else if (this.direction === 'right') {
      this.snake[0].x++;
    } else if (this.direction === 'left') {
      this.snake[0].x--;

    }
    this.borderCollision();
    this.snakeCollision();
    for (let i = 1; i < this.snake.length; i++) {
      this.snake[i].x = this.snakeLastState[i - 1].x;
      this.snake[i].y = this.snakeLastState[i - 1].y;
    }

    if (this.food.x === this.snake[0].x && this.snake[0].y === this.food.y) {
      const snakePixel = this.createSnakePixel(lastSnakePixel.x, lastSnakePixel.y);
      this.snake.push(snakePixel);
      this.generateRandomFood();
    }
  }

  private borderCollision() {
    if (this.ignoreBorders) {
      if (this.snake[0].x < 0) {
        this.snake[0].x = this.horizontalPixels - 1;
      }

      if (this.snake[0].y < 0) {
        this.snake[0].y = this.verticalPixels - 1;
      }

      if (this.snake[0].y > this.verticalPixels - 1) {
        this.snake[0].y = 0;
      }

      if (this.snake[0].x > this.horizontalPixels - 1) {
        this.snake[0].x = 0;
      }

    } else {
      if (this.snake[0].x < 0 || this.snake[0].x > this.horizontalPixels - 1 ||
        this.snake[0].y < 0 || this.snake[0].y > this.horizontalPixels - 1) {
          this.gameOver();
        return;
      }
    }
  }
  private snakeCollision() {
    const {x, y} = this.snake[0];
    for (let i = 1; i < this.snake.length; i++) {
      if (x === this.snake[i].x && y === this.snake[i].y) {
        this.gameOver();
      }
    }
  }

  private gameOver() {
    for (let i = 0; i < this.snakeLastState.length; i++) {
      this.snake[i].x = this.snakeLastState[i].x;
      this.snake[i].y = this.snakeLastState[i].y;
    }
    this.pause = true;
  }

  private drawSnake() {
    for (let i = 0; i < this.snake.length; i++) {
        const { x, y, element } = this.snake[i];
        const boundingClientRect = this.element.getBoundingClientRect();
        const wSize = boundingClientRect.width / this.verticalPixels;
        const hSize = boundingClientRect.height / this.horizontalPixels;
        const bcr = {
          x: boundingClientRect.x + wSize * x,
          y: boundingClientRect.y + hSize * y,
        };
        if (i === 0) {
          element.style.width = `${wSize}px`;
          element.style.height = `${hSize}px`;

          element.style.top = `${bcr.y}px`;
          element.style.left = `${bcr.x}px`;
        } else {
          const invertedI = this.snake.length - i;
          let percentage = invertedI / (this.snake.length * 1.1);
          percentage = percentage * 0.5 + 0.5 ;
          const newWSize = wSize * percentage;
          const newHSize = hSize * percentage;
          element.style.width = `${newWSize}px`;
          element.style.height = `${newHSize}px`;

          element.style.top = `${bcr.y + (hSize - newHSize) * 0.5}px`;
          element.style.left = `${bcr.x + (wSize - newWSize) * 0.5}px`;
        }

      if (!this.element.contains(element)) {
        this.element.append(element);
      }
    }
  }

  private createSnakePixel(x?: number, y?: number): Pixel {
    const element = document.createElement('div');
    element.classList.add(this.snakeBodyClass);
    if (x === undefined) {
      x = Math.round(this.verticalPixels * 0.5);
    }
    if (y === undefined) {
      y = Math.round(this.horizontalPixels * 0.5);
    }
    return { element, x, y};
  }

  private removeAllNodes() {
    while (this.element.lastChild) {
      this.element.removeChild(this.element.lastChild);
    }
  }

  private onKeypress = (ev: KeyboardEvent) => {
    switch (ev.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        if (this.snake[1] && this.snake[1].y + 1 === this.snake[0].y ) return;
        if (this.direction === 'up') return;
        this.direction = 'up';
        this.boxBounceAnimation('top', true);
        ev.preventDefault();
        ev.stopPropagation();
        break;
      case 's':
      case 'arrowdown':
        if (this.snake[1] && this.snake[1].y - 1 === this.snake[0].y) return;
        if (this.direction === 'down') return;
        this.direction = 'down';
        this.boxBounceAnimation('top', false);
        ev.preventDefault();
        ev.stopPropagation();
        break;
      case 'a':
      case 'arrowleft':
        if (this.snake[1] && this.snake[1].x + 1 === this.snake[0].x) return;
        if (!this.snake[0].x && this.snake[1].x) return;
        if (this.direction === 'left') return;
        this.direction = 'left';
        this.boxBounceAnimation('left', true);
        ev.preventDefault();
        ev.stopPropagation();
        break;
      case 'd':
      case 'arrowright':
        if (this.snake[1] && this.snake[1].x - 1 === this.snake[0].x) return;
        if (this.direction === 'right') return;
        this.direction = 'right';
        this.boxBounceAnimation('left', false);
        ev.preventDefault();
        ev.stopPropagation();
        break;
      case ' ':
        this.resetGame();
        break;
    }
  }

  private boxBounceAnimation(direction: 'top' | 'left', minus = false) {
    if (this.pause) return;
    const boundingClientRect = this.element.getBoundingClientRect();
    const distance = 5;
    const time = 50;
    const m = minus ? -1 : 1;
    const xy = direction === 'top' ? 'y' : 'x';
    this.element.style[direction] = `${boundingClientRect[xy] + (distance * m)}px`;
    setTimeout(() => {
      this.element.style[direction] = `${boundingClientRect[xy]}px`;
    }, time);
  }

  private resetGame() {
    if (this.pause) {
        this.createOrRewriteStyle();
        this.direction = 'up';
        for (const {element} of this.snake) {
          this.element.removeChild(element);
        }
        this.snake = [];
        this.snakeLastState = [];
        this.snake.push(this.createSnakePixel());
        this.generateRandomFood();
        this.drawSnake();
        this.pause = false;
      }
  }

  private generateRandomFood() {
    if (this.food) {
      document.body.removeChild(this.food.element);
      this.food = undefined;
    }

    if (this.verticalPixels * this.horizontalPixels <= this.snake.length) return this.gameOver();
    const x = this.randomInt(0, this.horizontalPixels);
    const y = this.randomInt(0, this.verticalPixels);
    for (const snake of this.snake) {
      if (snake.x === x && snake.y === y) return this.generateRandomFood();
    }

    const element = document.createElement('div');
    element.classList.add(this.foodClass);
    this.food = {x, y, element};
    this.fixFood();
    document.body.append(element);
  }

  private fixFood() {
    if (!this.food) return;
    const boundingClientRect = this.element.getBoundingClientRect();
    const wSize = boundingClientRect.width / this.verticalPixels;
    const hSize = boundingClientRect.height / this.horizontalPixels;
    this.food.element.style.height = `${wSize * 0.9}px`;
    this.food.element.style.width = `${hSize * 0.9}px`;
    this.food.element.style.borderRadius = '5px';
    const bcr = {
      x: boundingClientRect.x + wSize * this.food.x,
      y: boundingClientRect.y + hSize * this.food.y,
    };

    this.food.element.style.left = `${bcr.x}px`;
    this.food.element.style.top = `${bcr.y}px`;
  }

  private storeLastState() {
    this.snakeLastState = [];
    for (const snake of this.snake) {
      this.snakeLastState.push({x: snake.x, y: snake.y});
    }
  }

  private onResize = () => {
    const windowSize = this.getWindowSize;
    const boundingClientRect = this.element.getBoundingClientRect();
    this.drawSnake();
    this.fixFood();
    const left = windowSize.width * 0.5 - boundingClientRect.width * 0.5;
    const top = windowSize.height * 0.5 - boundingClientRect.height * 0.5;
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) ) + min;
  }

  switchMode() {
    this.ignoreBorders = !this.ignoreBorders;
    if (this.ignoreBorders) {
      console.log('Borders disabled');
    } else {
      console.log('Borders enabled');
    }
    if (!this.pause) this.pause = true;
  }

  message() {
    console.info('Snake game 1.0V by Lidcer');
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeypress);
    window.removeEventListener('touchstart', this.touchStart);
    window.removeEventListener('touchmove', this.touchMove);
    window.removeEventListener('touchend', this.touchEnd);

    for (const snake of this.snake) {
      const div = snake.element;
      if (div.parentElement.contains(div)) {
        div.parentElement.removeChild(div);
      }
    }
    this.snake = [];
    if (this.food) {
      if (this.food.element.parentElement.contains(this.food.element)) {
        this.food.element.parentElement.removeChild(this.food.element);
      }
      this.food = undefined;
    }
    this.removeAllNodes();
    this.element.parentElement.removeChild(this.element);
    const style = document.getElementById(this.lidcerStyle);
    if (style) {
      style.parentElement.removeChild(style);
    }
  }

  private get getWindowSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return { width, height };
  }
}

const snakeGame = new SnakeGame();
snakeGame.message();
(window as any).destroyGame = () => {
  (window as any).destroyGame = undefined;
  (window as any).switchMode = undefined;
  snakeGame.destroy();
};

console.log('to switch mode call switchMode() in console');
(window as any).switchMode = () => {
  snakeGame.switchMode();
};
