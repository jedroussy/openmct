/*global define,Float32Array*/

define([

], function (

) {

    // WebGL shader sources (for drawing plain colors)
    var FRAGMENT_SHADER = [
            "precision mediump float;",
            "uniform vec4 uColor;",
            "void main(void) {",
            "gl_FragColor = uColor;",
            "}"
        ].join('\n'),
        VERTEX_SHADER = [
            "attribute vec2 aVertexPosition;",
            "uniform vec2 uDimensions;",
            "uniform vec2 uOrigin;",
            "uniform float uPointSize;",
            "void main(void) {",
            "gl_Position = vec4(2.0 * ((aVertexPosition - uOrigin) / uDimensions) - vec2(1,1), 0, 1);",
            "gl_PointSize = uPointSize;",
            "}"
        ].join('\n');

    /**
     * Create a draw api utilizing WebGL.
     *
     * @constructor
     * @param {CanvasElement} canvas the canvas object to render upon
     * @throws {Error} an error is thrown if WebGL is unavailable.
     */
    function DrawWebGL(canvas, overlay) {
        this.canvas = canvas;
        this.gl = this.canvas.getContext("webgl", { preserveDrawingBuffer: true }) ||
            this.canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });

        this.overlay = overlay;
        this.c2d = overlay.getContext('2d');
        if (!this.c2d) {
            throw new Error("No canvas 2d!");
        }

        // Ensure a context was actually available before proceeding
        if (!this.gl) {
            throw new Error("WebGL unavailable.");
        }

        // Initialize shaders
        this.vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(this.vertexShader, VERTEX_SHADER);
        this.gl.compileShader(this.vertexShader);
        this.fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(this.fragmentShader, FRAGMENT_SHADER);
        this.gl.compileShader(this.fragmentShader);

        // Assemble vertex/fragment shaders into programs
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, this.vertexShader);
        this.gl.attachShader(this.program, this.fragmentShader);
        this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);

        // Get locations for attribs/uniforms from the
        // shader programs (to pass values into shaders at draw-time)
        this.aVertexPosition = this.gl.getAttribLocation(this.program, "aVertexPosition");
        this.uColor = this.gl.getUniformLocation(this.program, "uColor");
        this.uDimensions = this.gl.getUniformLocation(this.program, "uDimensions");
        this.uOrigin = this.gl.getUniformLocation(this.program, "uOrigin");
        this.uPointSize = this.gl.getUniformLocation(this.program, "uPointSize");

        this.gl.enableVertexAttribArray(this.aVertexPosition);

        // Create a buffer to holds points which will be drawn
        this.buffer = this.gl.createBuffer();

        // Use a line width of 2.0 for legibility
        this.gl.lineWidth(2.0);

        // Enable blending, for smoothness
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    // Convert from logical to physical x coordinates
    DrawWebGL.prototype.x = function (v) {
        return ((v - this.origin[0]) / this.dimensions[0]) * this.width;
    };

    // Convert from logical to physical y coordinates
    DrawWebGL.prototype.y = function (v) {
        return this.height -
            ((v - this.origin[1]) / this.dimensions[1]) * this.height;
    };

    DrawWebGL.prototype.doDraw = function (drawType, buf, color, points) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, buf, this.gl.DYNAMIC_DRAW);
        this.gl.vertexAttribPointer(this.aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform4fv(this.uColor, color);
        this.gl.drawArrays(drawType, 0, points);
    };

    DrawWebGL.prototype.clear = function () {
        this.height = this.canvas.height = this.canvas.offsetHeight;
        this.width = this.canvas.width = this.canvas.offsetWidth;
        this.overlay.height = this.overlay.offsetHeight;
        this.overlay.width = this.overlay.offsetWidth;
        // Set the viewport size; note that we use the width/height
        // that our WebGL context reports, which may be lower
        // resolution than the canvas we requested.
        this.gl.viewport(
            0,
            0,
            this.gl.drawingBufferWidth,
            this.gl.drawingBufferHeight
        );
        this.gl.clear(this.gl.COLOR_BUFFER_BIT + this.gl.DEPTH_BUFFER_BIT);
    };

    /**
     * Set the logical boundaries of the chart.
     * @param {number[]} dimensions the horizontal and
     *        vertical dimensions of the chart
     * @param {number[]} origin the horizontal/vertical
     *        origin of the chart
     */
    DrawWebGL.prototype.setDimensions = function (dimensions, origin) {
        this.dimensions = dimensions;
        this.origin = origin;
        if (dimensions && dimensions.length > 0 &&
                origin && origin.length > 0) {
            this.gl.uniform2fv(this.uDimensions, dimensions);
            this.gl.uniform2fv(this.uOrigin, origin);
        }
    };

    /**
     * Draw the supplied buffer as a line strip (a sequence
     * of line segments), in the chosen color.
     * @param {Float32Array} buf the line strip to draw,
     *        in alternating x/y positions
     * @param {number[]} color the color to use when drawing
     *        the line, as an RGBA color where each element
     *        is in the range of 0.0-1.0
     * @param {number} points the number of points to draw
     */
    DrawWebGL.prototype.drawLine = function (buf, color, points) {
        this.doDraw(this.gl.LINE_STRIP, buf, color, points);
    };

    /**
     * Draw the buffer as points.
     *
     */
    DrawWebGL.prototype.drawPoints = function (buf, color, points, pointSize) {
        this.gl.uniform1f(this.uPointSize, pointSize);
        this.doDraw(this.gl.POINTS, buf, color, points);
    };

    /**
     * Draw a rectangle extending from one corner to another,
     * in the chosen color.
     * @param {number[]} min the first corner of the rectangle
     * @param {number[]} max the opposite corner
     * @param {number[]} color the color to use when drawing
     *        the rectangle, as an RGBA color where each element
     *        is in the range of 0.0-1.0
     */
    DrawWebGL.prototype.drawSquare = function (min, max, color) {
        this.doDraw(this.gl.TRIANGLE_FAN, new Float32Array(
            min.concat([min[0], max[1]]).concat(max).concat([max[0], min[1]])
        ), color, 4);
    };

    DrawWebGL.prototype.drawLimitPoint = function (x, y, size) {
        this.c2d.fillRect(x + size, y, size, size);
        this.c2d.fillRect(x, y + size, size, size);
        this.c2d.fillRect(x - size, y, size, size);
        this.c2d.fillRect(x, y - size, size, size);
    };

    DrawWebGL.prototype.drawLimitPoints = function (points, color, pointSize) {
        var limitSize = pointSize * 2;
        var offset = limitSize / 2;

        var mappedColor = color.map(function (c, i) {
            return i < 3 ? Math.floor(c * 255) : (c);
        }).join(',');
        this.c2d.strokeStyle = "rgba(" + mappedColor + ")";
        this.c2d.fillStyle = "rgba(" + mappedColor + ")";

        for (var i = 0; i < points.length; i++) {
            this.drawLimitPoint(
                this.x(points[i].x) - offset,
                this.y(points[i].y) - offset,
                limitSize
            );
        }
    };

    return DrawWebGL;
});