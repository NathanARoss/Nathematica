export class ASTNode {
    constructor(value, left, right) {
        this.value = value;
        this.left = left;
        this.right = right;
    }

    //generate a debug tree that makes the structure of the tree visible
    getTreeHTML() {
        return this.getHTML();
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

        //check if either a or b is undefined, but not both
        //this prevents the following if statements from throwing errors
        if (!!a === !b) {
            return false;
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

    static equivalent(a, b) {
        if (ASTNode.equal(a, b)) {
            return true;
        }

        //for symmetrical operators such as +, *, and =, check if swapping the left and right
        //hand sides causes the terms to become equal
        if (a instanceof BinaryOperator && a.isSymmetrical() &&
            ASTNode.equal(a.left, b.right) &&
            ASTNode.equal(a.right, b.left)) {
            return true;
        }
    }
}

export class NumericLiteral extends ASTNode {
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
}

export class Function extends ASTNode {
    constructor(name, left, right) {
        super(name, left, right);
    }

    getTreeHTML() {
        return this.value + "<span class='leaf'>" + this.left.getHTML() + "</span>";
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
            "/": 4,
            "*": 3,
            "+": 2,
            "-": 2,
            "=": 0,
        };

        return precedence[this.value];
    }

    getTreeHTML() {
        console.assert(this.left && this.right && this.left.getHTML && this.right.getHTML, this);

        return "<span class='leaf'>" + this.left.getTreeHTML() + "</span>" + this.value + "<span class='leaf'>" + this.right.getTreeHTML() + "</span>";
    }

    getHTML() {
        console.assert(this.left && this.right && this.left.getHTML && this.right.getHTML, this);

        let leftSubExpression = this.left.getHTML();
        let rightSubExpression = this.right.getHTML();

        //divisions make their order of operations explicit by physically separating the numerator and denominator
        if (this.value === '/') {
            return "<div class='ratio'><span>" + leftSubExpression + "</span><span>" + rightSubExpression + "</span></div>";
        }

        //exponents are right associative, so a ^ on the right has a higher precedence than one on the left
        const precedence = this.precedence() + (this.value === '^');

        //for every other operator, parenthesis are necessary to indicate order
        if (this.left instanceof BinaryOperator && this.left.precedence() < precedence) {
            leftSubExpression = "(" + leftSubExpression + ")";
        }

        if (this.value === '^') {
            return leftSubExpression + "<sup>" + rightSubExpression + "</sup>";
        } else {
            //exponents physically separate the power, so no need to encapsulate the power in parenthesis
            if (this.right instanceof BinaryOperator && this.right.precedence() < this.precedence()) {
                rightSubExpression = "(" + rightSubExpression + ")";
            }

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

            if (this.right instanceof NumericLiteral && Math.floor(this.right.value) === this.right.value) {
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
        return "+*=".includes(this.value);
    }

    simplify() {
        if (this.left instanceof NumericLiteral && this.right instanceof NumericLiteral) {
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
                case '/':
                    const numerator = left;
                    const denominator = right;

                    if (denominator === 1) {
                        return this.left;
                    }
        
                    //attempt to reduce fraction when both numerator and demoninator are integers
                    if (numerator === Math.floor(numerator) && denominator === Math.floor(denominator)) {
                        const gdc = getGCD(numerator, denominator);
                        this.left.value /= gdc;
                        this.right.value /= gdc;
                    }

                    return this;
                case '^':
                    result = Math.pow(left, right);
                    break;
            }

            return new NumericLiteral(result);
        }

        //distribute across expressions when simplifying NumericLiterals isn't possible
        else if (this.value === '*') {
            if (this.left.value === 1) {
                return this.right;
            } else if (this.right.value === 1) {
                return this.left;
            } else if (this.left.value === '/' && this.right.value === '/') {
                const numerator = new BinaryOperator('*', this.left.left, this.right.left);
                const denominator = new BinaryOperator('*', this.left.right, this.right.right);
                return new BinaryOperator('/', numerator, denominator);
            } else if (ASTNode.equivalent(this.left, this.right)) {
                if (this.right.value === '^') {
                    return new BinaryOperator("*", new NumericLiteral('2'), this.right);
                } else {
                    // console.log(this)
                    return new BinaryOperator('^', this.right, new NumericLiteral('2'));
                }
            } else if (this.left.value === '^') {
                //detect cases like x^2 * x
                if (ASTNode.equivalent(this.left.left, this.right)) {
                    this.left.right = new BinaryOperator('+', this.left.right, new NumericLiteral('1'));
                    return this.left;
                }
            } else if (this.right.value === '^') {
                //detect cases like x * x^2
                if (ASTNode.equivalent(this.right.left, this.left)) {
                    this.right.right = new BinaryOperator('+', this.right.right, new NumericLiteral('1'));
                    return this.right;
                }
            }
        }

        else if (this.value === '+' || this.value === '-') {
            if (this.left.value === '/' && this.right.value === '/') {
                if (ASTNode.equal(this.left.right, this.right.right)) {
                    //both sides have the same demoninator (after simplification)
                    const numerator = new BinaryOperator(this.value, this.left.left, this.right.left);
                    const denominator = this.left.right;

                    return new BinaryOperator('/', numerator, denominator);
                } else if (!ASTNode.equivalent(this.left.right, this.right.right)) {
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

        else if (this.value === '/') {
            if (this.left.value === '/' && this.right.value === '/') {
                //reciprocate the right hand side fraction and turn this into a multiplication
                const temp = this.right.right;
                this.right.right = this.right.left;
                this.right.left = temp;

                this.value = '*';
                return this;
            } else if (this.left.value === '/') {
                //chains of divisions can be simplified by multiplying the demoninators together
                this.left.right = new BinaryOperator('*', this.left.right, this.right);
                return this.left;
            }
        }

        //if no other explicit simplifications through replacement were made,
        //then just try simplifying both halfs of the operator
        this.left = this.left.simplify();
        this.right = this.right.simplify();

        return this;
    }
}

//greatest common divisor to simplify fractions
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