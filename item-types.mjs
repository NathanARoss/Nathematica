export class ASTNode {
    constructor(value, left, right) {
        this.value = value;
        this.left = left;
        this.right = right;
    }

    getHTML() {
        return "";
    }

    getGLSL() {
        return "";
    }

    simplify() {
        return this;
    }

    isSymmetrical() {
        return true;
    }

    static equal(a, b) {
        if (a === b) {
            return true;
        }

        if (a.value !== b.value) {
            return false;
        }

        let leftSideEqual = ASTNode.equal(a.left, b.left);
        let rightSideEqual = ASTNode.equal(a.right, b.right);

        if (leftSideEqual && rightSideEqual) {
            return true;
        }

        return false;
    }

    static mathematicallyEqual(a, b) {
        if (ASTNode.equal(a, b)) {
            return true;
        }

        if (a instanceof BinaryOperator && a.isSymmetrical() &&
            ASTNode.equal(a.left, b.right) &&
            ASTNode.equal(a.right, b.left)) {
            return true;
        }
    }
}

export class Number extends ASTNode {
    constructor(value) {
        super(+value);
    }

    getHTML() {
        return String(this.value);
    }

    getGLSL() {
        let out = this.value.toFixed();
        if (!out.includes('.') && !out.includes('e')) {
            out += ".0";
        }

        return out;
    }

    multiply(factor) {
        if (factor instanceof Number) {
            this.value *= factor.value;
            return this;
        } else if (this.value === 1) {
            return factor;
        } else {
            return new BinaryOperator('*', factor, this);
        }
    }

    divide(factor) {
        if (factor instanceof Number) {
            this.value /= factor.value;
            return this;
        } else {
            return new Ratio(this, factor);
        }
    }
}

export class Variable extends ASTNode {
    constructor(name) {
        super(name);
    }

    getHTML() {
        return String(this.value);
    }

    getGLSL() {
        return this.value;
    }

    multiply(factor) {
        if (factor instanceof Variable && this.value === factor.value) {
            return new BinaryOperator('^', this, new Number('2'));
        } else if (factor instanceof Number && factor.value === 1) {
            return this;
        } else {
            return new BinaryOperator('*', factor, this);
        }
    }

    divide(factor) {
        return new Ratio(this, factor);
    }
}

export class Function extends ASTNode {
    constructor(name, left, right) {
        super(name, left, right);
    }

    getHTML() {
        return this.value + "(" + this.left.getHTML() + ")";
    }

    getGLSL() {
        return this.value + "(" + this.left.getGLSL() + ")";
    }
}

export class BinaryOperator extends ASTNode {
    constructor(op, left, right) {
        super(op, left, right);
    }

    precedence() {
        var precedence = {
            "^": 5,
            "*": 3,
            "+": 2,
            "-": 2,
            "=": 0,
        };

        return precedence[this.value];
    }

    getHTML() {
        console.assert(this.left && this.right && this.left.getHTML && this.right.getHTML, this);

        let leftSubExpression = this.left.getHTML();
        if (this.left instanceof BinaryOperator && this.left.precedence() < this.precedence()) {
            leftSubExpression = "(" + leftSubExpression + ")";
        }

        let rightSubExpression = this.right.getHTML();
        if (this.right instanceof BinaryOperator && this.right.precedence() < this.precedence()) {
            rightSubExpression = "(" + rightSubExpression + ")";
        }

        if (this.value === '^') {
            return leftSubExpression + "<span class='superscript'>" + rightSubExpression + "</span>";
        } else {
            let separator = ' ' + this.value + ' ';

            if (this.value === "*") {
                let rightNeighbor = this.right;
                while (rightNeighbor) {
                    if (rightNeighbor instanceof Variable) {
                        separator = '';
                        break;
                    } else if (rightNeighbor instanceof Function) {
                        separator = ' ';
                        break;
                    }
                    rightNeighbor = rightNeighbor.left;
                }
            }

            return leftSubExpression + separator + rightSubExpression;
        }
    }

    getGLSL() {
        let leftSubExpression = this.left.getGLSL();
        if (this.left instanceof BinaryOperator && this.left.precedence() < this.precedence()) {
            leftSubExpression = "(" + leftSubExpression + ")";
        }

        let rightSubExpression = this.right.getGLSL();
        if (this.right instanceof BinaryOperator && this.right.precedence() < this.precedence()) {
            rightSubExpression = "(" + rightSubExpression + ")";
        }

        if (this.value === '^') {
            let expression = "";

            if (this.right instanceof Number && Math.floor(this.right.value) === this.right.value) {
                //the power is an integer, attempt to preserve properties of integer powers of odd bases
                const power = this.right.value;

                if (power <= 6) {
                    expression = new Array(power).fill(leftSubExpression).join('*');
                } else {
                    const evenPower = Math.floor(power / 2) * 2;

                    if (evenPower !== 0) {
                        expression = "pow(abs(" + leftSubExpression + "), " + evenPower + ".0)";
                    }

                    if (evenPower !== power) {
                        expression += " * " + leftSubExpression;
                    }
                }


            } else {
                //glsl's pow function is undefined for negative bases
                expression = "pow(abs(" + leftSubExpression + "), " + rightSubExpression + ")";
            }

            return expression;
        } else {
            let separator = ' ' + this.value + ' ';
            return leftSubExpression + separator + rightSubExpression;
        }
    }

    isSymmetrical() {
        return this.value !== '-';
    }

    simplify() {
        if (this.left instanceof Number && this.right instanceof Number) {
            const left = this.left.value;
            const right = this.right.value;

            let result = 0;
            switch (this.value) {
                case '+':
                    result = left + right;
                    break;
                case '-':
                    result = left - right;
                    break;
                case '*':
                    result = left * right;
                    break;
                case '^':
                    result = Math.pow(left, right);
                    break;
            }

            return new Number(result);
        }

        //distribute across expressions when simplifying numbers isn't possible
        if (this.value === '*') {
            if (this.left instanceof Ratio && this.right instanceof Ratio) {
                const numerator = new BinaryOperator('*', this.left.left, this.right.left);
                const denominator = new BinaryOperator('*', this.left.right, this.right.right);
                return new Ratio(numerator, denominator);
            } else if (
                !(this.left instanceof Number) && (this.right instanceof Number) ||
                this.left instanceof Variable && this.right instanceof Variable ||
                (this.left instanceof BinaryOperator && this.left.value !== '*') ||
                (this.right instanceof BinaryOperator && this.right.value !== '*' && this.right.value !== '^')) {
                return this.left.multiply(this.right);
            }
        }

        if (this.value === '+') {
            if (this.left instanceof Ratio && this.right instanceof Ratio) {
                if (ASTNode.equal(this.left.right, this.right.right)) {
                    //both sides have the same demoninator (after simplification)
                    const numerator = new BinaryOperator('+', this.left.left, this.right.left);
                    const denominator = this.left.right;

                    return new Ratio(numerator, denominator);
                } else if (!ASTNode.mathematicallyEqual(this.left.right, this.right.right)) {
                    //both sides have denominators of differing value, so multiply to find the common denominator
                    this.left.left = new BinaryOperator('*', this.left.left, this.right.right);
                    this.right.left = new BinaryOperator('*', this.right.left, this.left.right);

                    const leftDenominator = new BinaryOperator('*', this.left.right, this.right.right);
                    const rightDenominator = new BinaryOperator('*', this.right.right, this.left.right);
                    this.left.right = leftDenominator;
                    this.right.right = rightDenominator;

                    return this;
                }
            }
        }

        this.left = this.left.simplify();
        this.right = this.right.simplify();

        return this;
    }

    multiply(factor) {
        if (factor instanceof Number && factor.value === 1) {
            return this;
        }

        switch (this.value) {
            case '+':
            case '-':
                this.left = this.left.multiply(factor);
                this.right = this.right.multiply(factor);
                break;
            case '*':
                this.left = this.left.multiply(factor);
                break;
            case '^':
                if (this.left instanceof Variable && factor instanceof Variable && this.left.value === factor.value) {
                    this.right = new BinaryOperator('+', this.right, new Number('1'));
                } else {
                    return new BinaryOperator('*', factor, this);
                }
        }

        return this;
    }

    divide(factor) {
        switch (this.value) {
            case '+':
            case '-':
                this.left = new Ratio(this.left, factor);
                this.right = new Ratio(this.right, factor);
                break;
            case '*':
                this.left = new Ratio(this.left, factor);
                break;
            case '^':
                return new Ratio(this, factor);
        }

        return this;
    }
}

export class Ratio extends BinaryOperator {
    constructor(left, right) {
        super('/', left, right);
    }

    precedence() {
        return 4;
    }

    getHTML() {
        return "<div class='ratio'><span>" + this.left.getHTML() + "</span><span>" + this.right.getHTML() + "</span></div>";
    }

    getGLSL() {
        return "(" + this.left.getGLSL() + ") / (" + this.right.getGLSL() + ")";
    }

    isSymmetrical() {
        return false;
    }

    simplify() {
        if (this.left instanceof Number && this.right instanceof Number) {
            const numerator = this.left.value;
            const denominator = this.right.value;

            if (denominator === 1) {
                return new Number(numerator);
            }

            if (numerator === Math.floor(numerator) && denominator === Math.floor(denominator)) {
                const gdc = getGCD(numerator, denominator);
                this.left.value /= gdc;
                this.right.value /= gdc;
            }
        } else {
            this.left = this.left.simplify();
            this.right = this.right.simplify();
        }

        return this;
    }

    multiply(factor) {
        if (factor instanceof Number && factor.value === 1) {
            return this;
        }
        this.left = this.left.multiply(factor);
    }

    divide(factor) {
        this.right = this.right.multiply(factor);
    }

    multiplyAgainstRatio(ratio) {
        this.left = this.left.multiply(ratio.left);
        this.right = this.right.multiply(ratio.right);
    }

    reciprocal() {
        const temp = this.left;
        this.left = this.right;
        this.right = temp;
    }
}

export class Parenthesis extends ASTNode {
    constructor(name) {
        super(name);
    }
}

function getGCD(x, y) {
    x = Math.abs(x);
    y = Math.abs(y);

    while (y) {
        const t = y;
        y = x % y;
        x = t;
    }

    return x;
}