import * as ItemTypes from "./item-types.mjs";

const queryForm = document.getElementById("query-bar");
const queryInput = queryForm.querySelector("input[type='text']");
const inputInterpretation = document.getElementById("input-interpretation");
const solutionSteps = document.getElementById("solution-steps");



queryForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const query = queryInput.value;
    const ast = getAST(query);
    // console.dir(ast);

    const out = ast.toHTML();
    inputInterpretation.innerHTML = out;

    solutionSteps.innerHTML = "";

    let notFinished = true;
    for (let i = 0; notFinished && i < 10; ++i) {
        notFinished = ast.simplify();
        const step = document.createElement("div");
        step.innerHTML = ast.toHTML();
        step.classList.add("formula-display");
        solutionSteps.appendChild(step);
    }

    return false;
});

function getAST(expressionString) {
    const tokens = expressionString.match(/\d+|cos|sin|tan|theta|pi|[a-zπΠΘθ]|[-=+*^\\/()]/gi);

    if (!tokens || tokens.length === 0) {
        return false;
    }

    const expression = [];
    const opStack = [];

    const LEFT_PARENTHESIS = new ItemTypes.Parenthesis("(");

    function addNode(item) {
        item.right = null;
        if (item instanceof ItemTypes.BinaryOperator) {
            item.right = expression.pop();
        }

        item.left = expression.pop();
        expression.push(item);
    }

    function peekOpStack() {
        return opStack[opStack.length - 1];
    }

    //this is its own function so I can manually insert implicit multiplications
    function handleOperator(op) {
        //manage operator precendence
        const item = new ItemTypes.BinaryOperator(op);
        while (
            opStack.length > 0 && peekOpStack() instanceof ItemTypes.BinaryOperator &&
            (
                (op !== '^' && item.precedence() <= peekOpStack().precedence()) ||
                (op === '^' && item.precedence() < peekOpStack().precedence())
            )
        ) {
            addNode(opStack.pop());
        }
        opStack.push(item);
    }

    for (let i = 0; i < tokens.length; ++i) {
        const token = tokens[i];

        //detect implicit multiplication
        if (/\d+|cos|sin|tan|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (i > 0 && /\d+|cos|sin|tan|theta|pi|[a-zπΠΘθ]/i.test(tokens[i - 1])) {
                handleOperator('*');
            }
        }

        if (/cos|sin|tan/i.test(token)) {
            opStack.push(new ItemTypes.Function(token));
        } else if (/\d+|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (/\d+/.test(token)) {
                expression.push(new ItemTypes.Number(token));
            } else {
                let name = token;
                if (token.toLowerCase() === "theta") {
                    name = 'θ';
                } else if (token.toLowerCase() === "pi") {
                    name = 'π';
                }
                expression.push(new ItemTypes.Variable(name));
            }
        } else if (/[-=+*^\\/]/.test(token)) {
            handleOperator(token);
        } else if (token === '(') {
            opStack.push(LEFT_PARENTHESIS)
        } else if (token === ')') {
            //move everything between the ) and the matching ( to the expression
            while (opStack.length > 0 && peekOpStack() !== LEFT_PARENTHESIS) {
                addNode(opStack.pop());
            }

            //pop left parenthesis
            console.assert(opStack.pop() === LEFT_PARENTHESIS, "meant to pop lparen");

            //catch function calls to the left of of parenthesis
            if (opStack.length > 0 && peekOpStack() instanceof ItemTypes.Function) {
                addNode(opStack.pop());
            } else if (expression.length > opStack.length + 1) {
                console.log("I think there is a function-style multiplication going on here.", expression, opStack);
                //catch use cases like y = 2(x(y)) meaning 2*x*y
                handleOperator('*');
            }
        }
    }

    //move remaining operators
    while (opStack.length > 0) {
        addNode(opStack.pop());
    }

    const ast = expression.pop();
    console.assert(expression.length === 0, "expression should have no more entries", ...expression);

    return ast;
}