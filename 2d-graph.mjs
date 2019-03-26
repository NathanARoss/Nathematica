const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl", {
    alpha: false,
    depth: false, //needed for depth culling
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
});

let programInfo = {};

const backgroundModel = initTexturedBox(gl, 0, 0, 255, 255);

loadTexture(gl, "gridcell.png");

let zoomOut = 8;
let aspectRatio = 1;
let cameraX = 0;
let cameraY = 0;

document.body.onresize = function () {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;

    gl.viewport(0, 0, canvas.width, canvas.height);

    aspectRatio = canvas.clientWidth / canvas.clientHeight;
    updateCameraScale(zoomOut, aspectRatio);

    requestAnimationFrame(drawScene);
};


function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}


function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const image = new Image();
    image.src = url;

    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        requestAnimationFrame(drawScene);
    };

    image.onerror = function () {
        const pixel = new Uint8Array([0, 255, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, pixel);

        requestAnimationFrame(drawScene);
    }

    return texture;
}


function drawScene(timestamp) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundModel.buffer);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.BYTE, false, 2, 0);
    gl.drawArrays(backgroundModel.mode, 0, backgroundModel.vertexCount);

    gl.disableVertexAttribArray(programInfo.attribLocations.position);
}



let mouseInside; {
    canvas.touchId = -1;

    canvas.onmousedown = function (event) {
        onpointerdown(event.x, event.y);
        this.down = true;
    };

    canvas.onmousemove = function (event) {
        if (this.down == true)
            onpointermove(event.x, event.y);
    };

    canvas.onmouseup = function (event) {
        onpointerup();
        this.down = false;
    };

    canvas.onmouseleave = function (event) {
        var e = event.toElement || event.relatedTarget;
        if (this.down) {
            onpointerup();
        }
        this.down = false;
        mouseInside = false;
    };

    canvas.onmouseenter = function (event) {
        mouseInside = true;
    };

    canvas.addEventListener("touchstart", function (event) {
        if (this.touchId === -1) {
            const touch = event.changedTouches[0];
            this.touchId = touch.identifier;
            onpointerdown(touch.pageX, touch.pageY);
        }
    });

    function existingTouchHandler(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            if (touch.identifier === this.touchId) {
                switch (event.type) {
                    case "touchmove":
                        onpointermove(touch.pageX, touch.pageY);
                        break;

                    case "touchend":
                    case "touchcancel":
                        onpointerup();
                        this.touchId = -1;
                        break;
                }
            }
        }
    }

    canvas.addEventListener("touchmove", existingTouchHandler);
    canvas.addEventListener("touchend", existingTouchHandler);
    canvas.addEventListener("touchcancel", existingTouchHandler);
}

document.onwheel = function (event) {
    if (mouseInside) {
        event.preventDefault();

        if (event.deltaY > 0) {
            ++zoomOut;
        } else {
            --zoomOut;
        }

        updateCameraScale(zoomOut, aspectRatio);
    }
}

let downX, downY, isCursorDown, cameraDownX, cameraDownY;
const onpointerdown = (x, y) => {
    downX = x;
    downY = y;
    cameraDownX = cameraX;
    cameraDownY = cameraY
    isCursorDown = true;
}

const onpointermove = (x, y) => {
    if (isCursorDown) {
        const scale = getScale(zoomOut) * 2;
        cameraX = -(x - downX) / canvas.clientWidth * scale * aspectRatio + cameraDownX;
        cameraY = (y - downY) / canvas.clientHeight * scale + cameraDownY;
        gl.uniform2f(programInfo.uniformLocations.uOffset, cameraX, cameraY);
        requestAnimationFrame(drawScene);
    }
}

const onpointerup = () => {
    isCursorDown = false;
}

function initTexturedBox(gl) {
    const model = new Int8Array(4 * 4);
    let i = 0;

    const min = -1;
    const max = 1;

    model[i++] = max;
    model[i++] = max;

    model[i++] = min;
    model[i++] = max;

    model[i++] = max;
    model[i++] = min;

    model[i++] = min;
    model[i++] = min;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, model, gl.STATIC_DRAW);

    return {
        buffer,
        vertexCount: model.length / 4,
        mode: gl.TRIANGLE_STRIP
    };
}

export function drawGraph(expression) {
    const vertexShaderSource =
        `uniform mediump vec2 uScale;
    uniform mediump vec2 uOffset;
    attribute mediump vec4 aPosition;
    varying mediump vec2 vPosition;

    void main(void) {
        gl_Position = aPosition;
        vPosition = aPosition.xy * uScale + uOffset;
        // vPosition = fract(uScale);
    }`;

    const fragmentShaderSource =
        `uniform sampler2D uSampler;
    uniform mediump float uWidth;
    varying mediump vec2 vPosition;

    mediump float getSample(float x, float y) {
        return ${expression};
    }

    void main(void) {
        lowp vec4 color = texture2D(uSampler, vPosition);
        mediump float axisWidth = max(1.0/32.0, uWidth);
        if (abs(vPosition.x) < axisWidth || abs(vPosition.y) < axisWidth) {
            color = vec4(0, 0, 0, 1);
        }

        mediump float leftSample = getSample(vPosition.x - uWidth, vPosition.y);
        mediump float rightSample = getSample(vPosition.x + uWidth, vPosition.y);
        mediump float downSample = getSample(vPosition.x, vPosition.y - uWidth);
        mediump float upSample = getSample(vPosition.x, vPosition.y + uWidth);

        if (leftSample * rightSample < 0.0 || downSample * upSample < 0.0) {
            color = vec4(0, 0, 1, 1);
        }

        gl_FragColor = color;
    }`;

    console.log(expression);

    const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(shaderProgram);

    programInfo = {
        program: shaderProgram,
        attribLocations: {
            position: gl.getAttribLocation(shaderProgram, 'aPosition'),
        },
        uniformLocations: {
            uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
            uWidth: gl.getUniformLocation(shaderProgram, 'uWidth'),
            uScale: gl.getUniformLocation(shaderProgram, 'uScale'),
            uOffset: gl.getUniformLocation(shaderProgram, 'uOffset'),
        },
    };

    gl.uniform2f(programInfo.uniformLocations.uOffset, cameraX, cameraY);
    document.body.onresize();
}
drawGraph("pow(abs(x), 2.0) * x - 2.0 * x + 1.0 - (pow(abs(y), 2.0))");

function updateCameraScale(zoomOut, aspectRatio) {
    const scale = getScale(zoomOut);
    gl.uniform2f(programInfo.uniformLocations.uScale, scale * aspectRatio, scale);

    const width = scale / 128;
    gl.uniform1f(programInfo.uniformLocations.uWidth, width);

    requestAnimationFrame(drawScene);
}

function getScale(zoomOut) {
    return Math.pow(2 ** 0.25, zoomOut);
}