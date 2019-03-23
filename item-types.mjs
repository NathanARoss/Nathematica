export class ASTNode {
    constructor(value, left, right) {
        this.value = value;
        this.left = left;
        this.right = right;
    }

    sort() {

    }

    getHTML() {
        return "";
    }

    getGLSL() {
        return "";
    }

    simplify() {
        return false;
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
        return this.value.toExponential();
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
        } if (factor instanceof Number && factor.value === 1) {
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

    sort() {
        //sort the left and right hand side so literals prefer being on the left
        if (this.value === '*' && !(this.left instanceof Number) && this.right instanceof Number) {
            const temp = this.left;
            this.left = this.right;
            this.right = temp;
        }

        this.left.sort();
        this.right.sort();
    }

    precedence() {
        var precedence = {
            "^": 4,
            "*": 3,
            "+": 2,
            "-": 2,
            "=": 0,
        };

        return precedence[this.value];
    }

    getHTML() {
        console.assert(this.left.getHTML && this.right.getHTML, this);

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
            return "pow(" + leftSubExpression + ", " + rightSubExpression + ")";
        } else {
            let separator = ' ' + this.value + ' ';
            return leftSubExpression + separator + rightSubExpression;
        }
    }

    simplify(parent, isRight) {
        let simplified = this.left.simplify(this, false);

        if (!simplified) {
            simplified = this.right.simplify(this, true);
        }

        if (!simplified) {
            const left = this.left.value;
            const right = this.right.value;

            if (this.left instanceof Number && this.right instanceof Number) {
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

                const newNode = new Number(result);

                if (isRight) {
                    parent.right = newNode;
                } else {
                    parent.left = newNode;
                }

                return true;
            } else {
                //distribute across expressions when simplifying numbers isn't possible
                if (this.value === '*') {
                    // console.log(this.value, this.left, this.right);
                    if (
                        !(this.left instanceof Number) && (this.right instanceof Number) ||
                        this.left instanceof Variable && this.right instanceof Variable ||
                        (this.left instanceof BinaryOperator && this.left.value !== '*')
                        || (this.right instanceof BinaryOperator && this.right.value !== '*' && this.right.value !== '^')) {
                        this.left = this.left.multiply(this.right);

                        if (isRight) {
                            parent.right = this.left;
                        } else {
                            parent.left = this.left;
                        }

                        return true;
                    }

                }
            }
        }

        return simplified;
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
        return 3;
    }

    getHTML() {
        return "<div class='ratio'><span>" + this.left.getHTML() + "</span><span>" + this.right.getHTML() + "</span></div>";
    }

    getGLSL() {
        return this.left.getGLSL() + " / " + this.right.getGLSL();
    }

    simplify(parent, isRight) {
        let simplified = this.left.simplify(this, false);

        if (!simplified) {
            simplified = this.right.simplify(this, true);
        }

        if (!simplified) {
            if (this.left instanceof Number && this.right instanceof Number) {
                let newNode;

                const left = this.left.value;
                const right = this.right.value;

                if (right === 1) {
                    newNode = new Number(left);
                } else if (left === Math.floor(left) && right === Math.floor(right)) {
                    const gdc = getGCD(this.left.value, this.right.value);
                    if (gdc > 1) {
                        newNode = new BinaryOperator('/', new Number(left / gdc), new Number(right / gdc));
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }

                if (isRight) {
                    parent.right = newNode;
                } else {
                    parent.left = newNode;
                }

                return true;
            }
        }

        return simplified;
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