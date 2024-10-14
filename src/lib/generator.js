import { PNG } from 'pngjs/browser'

class ImageAnalyzer {
  constructor(png) {
    this.png = png
  }

  initialize() {
    this.threshold = [0, 1, 2].map(offset => {
      const colors = this.corners().map(arr => arr[offset])
      return Math.max(...colors)
    })

    // top
    const threshold = this.threshold
    const png = this.png
    const isOpaque = (color) => this.isOpaque(color)

    const mapColor = (x, y) => {
      const index = (png.width * y + x) * 4
      return [0, 1, 2, 3].map(offset => png.data[index + offset])
    }
    const top = [...Array(png.height).keys()].find(y => {
      const colors = [...Array(png.width).keys()].map(x => mapColor(x, y))
      return colors.some(isOpaque)
    })
    const left = [...Array(png.width).keys()].find(x => {
      const colors = [...Array(png.width).keys()].map(y => mapColor(x, y))
      return colors.some(isOpaque)
    })
    const bottom = [...Array(png.height).keys()].reverse().find(y => {
      const colors = [...Array(png.width).keys()].map(x => mapColor(x, y))
      return colors.some(isOpaque)
    })
    const right = [...Array(png.width).keys()].reverse().find(x => {
      const colors = [...Array(png.width).keys()].map(y => mapColor(x, y))
      return colors.some(isOpaque)
    })

    this.trimming = {
      left: left,
      top: top,
      right: right,
      bottom: bottom
    }
  }

  corners() {
    const png = this.png
    return [
      0,
      png.width - 1,
      png.width * (png.height - 1),
      png.width * (png.height - 1) + png.width - 1
    ].map(pos => {
      const index = pos * 4
      return [
        png.data[index],     //r
        png.data[index + 1], //g
        png.data[index + 2]  //b
      ]
    })
  }

  trimmingRect() {
    return {
      width: this.trimming.right - this.trimming.left + 1,
      height: this.trimming.bottom - this.trimming.top + 1
    }
  }

  isOpaque(color, colorMargin = 7) {
    const threshold = this.threshold
    if ( color[3] < 0xff ) { return false }

    return [0, 1, 2].some(offset => color[offset] > threshold[offset] + colorMargin)
  }
}

class Trimmer {
  constructor(imageAnalyzer) {
    this.imageAnalyzer = imageAnalyzer
  }

  call(newfile) {
    const rect = this.imageAnalyzer.trimmingRect()
    const trimming = this.imageAnalyzer.trimming
    const png = this.imageAnalyzer.png
    png.bitblt(newfile, trimming.left, trimming.top, rect.width, rect.height, 0, 0)
  }
}

class Filler {
  constructor(imageAnalyzer) {
    this.imageAnalyzer = imageAnalyzer
    this.rect = imageAnalyzer.trimmingRect()
  }

  call(newfile) {
    this.#fillOuter(newfile)
    this.#makeStraight(newfile)
  }

  #fillOuter(newfile) {
    const source = Buffer.from(newfile.data)
    const rect = this.imageAnalyzer.trimmingRect()

    const MARGIN = {
      LEFT: 10,
      TOP: 16,
      RIGHT: 8,
      BOTTOM: 8
    }

    // left->right
    for(const y of Array(rect.height).keys()) {
      for(const x of Array(rect.width).keys()) {
        const color = this.#mapColor(source, x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        this.#makeTransparent(newfile, x, y)
      }
    }

    // top->bottom
    for(const x of Array(rect.width).keys()) {
      for(const y of Array(rect.height).keys()) {
        const color = this.#mapColor(source, x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        this.#makeTransparent(newfile, x, y)
      }
    }

    // right->left
    for(const y of Array(rect.height).keys()) {
      if ( MARGIN.TOP < y && y < (rect.height - MARGIN.BOTTOM) ) { continue }

      for(const x of [...Array(rect.width).keys()].reverse()) {
        const color = this.#mapColor(source, x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        this.#makeTransparent(newfile, x, y)
      }
    }

    // bottom->top
    for(const x of Array(rect.width).keys()) {
      if ( MARGIN.LEFT < x && x < (rect.width - MARGIN.RIGHT) ) { continue }

      for(const y of [...Array(rect.height).keys()].reverse()) {
        const color = this.#mapColor(source, x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        this.#makeTransparent(newfile, x, y)
      }
    }
  }

  #makeStraight(newfile) {
    const source = Buffer.from(newfile.data)
    const rect = this.imageAnalyzer.trimmingRect()

    const MARGIN = {
      LEFT: 30,
      TOP: 30,
      RIGHT: 12,
      BOTTOM: 12
    }

    // left->right
    const firstXs = this.#range(MARGIN.TOP, rect.height - MARGIN.BOTTOM).map(y => {
      return [...Array(rect.width).keys()].find(x => this.imageAnalyzer.isOpaque(this.#mapColor(source, x, y)))
    })
    const maxX = Math.max(...firstXs);
    [...Array(rect.height).keys()].forEach(y => {
      const firstX = [...Array(rect.width).keys()].find(x => this.imageAnalyzer.isOpaque(this.#mapColor(source, x, y)))
      if ( firstX == maxX - 1 ) {
        this.#makeTransparent(newfile, firstX, y)
      }
    })

    // top->bottom
    const firstYs = this.#range(MARGIN.LEFT, rect.width - MARGIN.RIGHT).map(x => {
      return [...Array(rect.height).keys()].find(y => this.imageAnalyzer.isOpaque(this.#mapColor(source, x, y)))
    })
    const maxY = Math.max(...firstYs);
    [...Array(rect.width).keys()].forEach(x => {
      const firstY = [...Array(rect.height).keys()].find(y => this.imageAnalyzer.isOpaque(this.#mapColor(source, x, y)))
      if ( firstY == maxY - 1 ) {
        this.#makeTransparent(newfile, x, firstY)
      }
    })
  }

  #posToIndex(x, y) {
    return (this.rect.width * y + x) * 4
  }

  #mapColor(source, x, y) {
    const index = this.#posToIndex(x, y)
    return [0, 1, 2, 3].map(offset => source[index + offset])
  }

  #makeTransparent(newfile, x, y) {
    const index = this.#posToIndex(x, y)
    newfile.data[index]     = 0
    newfile.data[index + 1] = 0
    newfile.data[index + 2] = 0
    newfile.data[index + 3] = 0
  }

  #range(a, b) {
    return b > a
      ? [...Array(b - a).keys()].map(e => e + a)
      : [...Array(a - b).keys()].map(e => e + b).reverse()
  }
}

export class Generator {
  static generate(png) {
    const imageAnalyzer = new ImageAnalyzer(png)
    imageAnalyzer.initialize()

    const newfile = new PNG({...imageAnalyzer.trimmingRect(), alpha: true});

    const trimmer = new Trimmer(imageAnalyzer)
    trimmer.call(newfile)

    const filler = new Filler(imageAnalyzer)
    filler.call(newfile)

    return newfile
  }
}