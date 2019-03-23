export class Mat4 {
    constructor() {
        this.data = new Float32Array(16);
        this.data[0] = 1;
        this.data[5] = 1;
        this.data[10] = 1;
        this.data[15] = 1;
    }

    static perspectiveMatrix(out, fov, aspect, near, far) {
        let f = 1 / Math.tan(fov / 2);
        let nf = 1 / (near - far);

        out.data.fill(0);
        out.data[0] = f / aspect;
        out.data[5] = f;
        out.data[10] = (far + near) * nf;
        out.data[11] = -1;
        out.data[14] = 2 * far * near * nf;
    }

    static lookAt(out, eye, center, up) {
        /* taken from gl-matrix.js library */
        let z0 = eye[0] - center[0];
        let z1 = eye[1] - center[1];
        let z2 = eye[2] - center[2];

        let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
        z0 *= len;
        z1 *= len;
        z2 *= len;

        let x0 = up[1] * z2 - up[2] * z1;
        let x1 = up[2] * z0 - up[0] * z2;
        let x2 = up[0] * z1 - up[1] * z0;
        len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
        if (!len) {
            x0 = 0;
            x1 = 0;
            x2 = 0;
        } else {
            len = 1 / len;
            x0 *= len;
            x1 *= len;
            x2 *= len;
        }

        let y0 = z1 * x2 - z2 * x1;
        let y1 = z2 * x0 - z0 * x2;
        let y2 = z0 * x1 - z1 * x0;

        len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
        if (!len) {
            len = 1 / len;
            y0 *= len;
            y1 *= len;
            y2 *= len;
        }

        out.data[0] = x0;
        out.data[1] = y0;
        out.data[2] = z0;
        out.data[3] = 0;
        out.data[4] = x1;
        out.data[5] = y1;
        out.data[6] = z1;
        out.data[7] = 0;
        out.data[8] = x2;
        out.data[9] = y2;
        out.data[10] = z2;
        out.data[11] = 0;
        out.data[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
        out.data[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
        out.data[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
        out.data[15] = 1;
    }

    static multiply(out, a, b) {
        for (let i = 0; i < 16; ++i) {
            out.data[i] = b.data[0 | i & ~3] * a.data[0 | i & 3]
                + b.data[1 | i & ~3] * a.data[4 | i & 3]
                + b.data[2 | i & ~3] * a.data[8 | i & 3]
                + b.data[3 | i & ~3] * a.data[12 | i & 3];
        }
    }

    static multiplyVec4(out, mat, vec) {
        for (let i = 0; i < 4; ++i) {
            out.data[i] = vec.data[0] * mat.data[i]
                + vec.data[1] * mat.data[4 + i]
                + vec.data[2] * mat.data[8 + i]
                + vec.data[3] * mat.data[12 + i]
        }
    }

    static translate(out, a, [x, y, z]) {
        if (a !== out) {
            out.data.set(a.data.slice(0, 12));
        }

        out.data[12] = a.data[0] * x + a.data[4] * y + a.data[8] * z + a.data[12];
        out.data[13] = a.data[1] * x + a.data[5] * y + a.data[9] * z + a.data[13];
        out.data[14] = a.data[2] * x + a.data[6] * y + a.data[10] * z + a.data[14];
        out.data[15] = a.data[3] * x + a.data[7] * y + a.data[11] * z + a.data[15];
    }

    static scale(out, a, [x, y, z]) {
        for (let i = 0; i < 4; ++i) {
            out.data[0 + i] = a.data[0 + i] * x;
            out.data[4 + i] = a.data[4 + i] * y;
            out.data[8 + i] = a.data[8 + i] * z;
            out.data[12 + i] = a.data[12 + i];
        }
    }

    static rotate(out, a, rad, axis) {
        /* taken from gl-matrix.js library */
        const [x, y, z] = axis;
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const t = 1 - c;

        // Construct the elements of the rotation matrix
        const b = [];
        b[0] = x * x * t + c;
        b[1] = y * x * t + z * s;
        b[2] = z * x * t - y * s;
        b[3] = x * y * t - z * s;
        b[4] = y * y * t + c;
        b[5] = z * y * t + x * s;
        b[6] = x * z * t + y * s;
        b[7] = y * z * t - x * s;
        b[8] = z * z * t + c;

        const copy = a.data.slice();
        for (let i = 0; i < 12; ++i) {
            out.data[i] = copy[i & 3] * b[~~(i / 4) * 3] + copy[4 | i & 3] * b[~~(i / 4) * 3 + 1] + copy[8 | i & 3] * b[~~(i / 4) * 3 + 2];
        }

        if (a !== out) { // If the source and destination differ, copy the unchanged last row
            out.data.set(copy.slice(12), 12);
        }
        return out;
    }

    static invert(out, a) {
        /* taken from gl-matrix.js library */
        let [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a.data;

        let b00 = a00 * a11 - a01 * a10;
        let b01 = a00 * a12 - a02 * a10;
        let b02 = a00 * a13 - a03 * a10;
        let b03 = a01 * a12 - a02 * a11;
        let b04 = a01 * a13 - a03 * a11;
        let b05 = a02 * a13 - a03 * a12;
        let b06 = a20 * a31 - a21 * a30;
        let b07 = a20 * a32 - a22 * a30;
        let b08 = a20 * a33 - a23 * a30;
        let b09 = a21 * a32 - a22 * a31;
        let b10 = a21 * a33 - a23 * a31;
        let b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

        if (!det) {
            return null;
        }
        det = 1.0 / det;

        out.data[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out.data[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out.data[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out.data[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out.data[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out.data[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out.data[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out.data[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out.data[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out.data[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out.data[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out.data[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out.data[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out.data[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out.data[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out.data[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    }

    /**
     * returns a ray shooting out of the camera at the given clipspace point
     * @param {Mat4} viewProjectionMatrix matrix used to draw world
     * @param {[Number]} clipSpacePoint array of x and y point in clipspace
     * @returns {[Number]} ray in worldspace (not normalized)
     */
    static getRayFromClipspace(viewPerspectiveMatrix, clipSpacePoint) {
        const clipPoint = new Vec4(...clipSpacePoint, 1, 1);

        const ray = new Vec4();
        Mat4.invert(Mat4.temp, viewPerspectiveMatrix);
        Mat4.multiplyVec4(ray, Mat4.temp, clipPoint);

        return ray.data.slice(0, 3);
    }
}

Mat4.IDENTITY = new Mat4();
Mat4.temp = new Mat4();



export class Vec4 {
    constructor(x = 0, y = 0, z = 0, w = 0) {
        this.data = new Float32Array(4);
        this.data.set([x, y, z, w]);
    }
}


function dotFunction(accumulator, currentValue) {
    return accumulator + currentValue ** 2;
}

function normalize(arr) {
    const dot = arr.reduce(dotFunction, 0);
    const magnitude = Math.sqrt(dot);
    if (dot !== 0) {
        for (let i = 0; i < arr.length; ++i) {
            arr[i] /= magnitude;
        }
    }
    return magnitude;
}

function reflect(incoming, normal) {
    const dot = incoming[0] * normal[0] + incoming[1] * normal[1];
    const out = [];
    out[0] = incoming[0] - 2 * dot * normal[0];
    out[1] = incoming[1] - 2 * dot * normal[1];
    return out;
}