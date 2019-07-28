import * as ItemTypes from "./item-types.mjs";
import {
    enableGraph,
    disableGraph
} from "./2d-graph.mjs";

const queryForm = document.getElementById("query-bar");
const queryInput = queryForm.querySelector("input[type='text']");
const inputInterpretation = document.getElementById("input-interpretation");
const graphEquation = document.getElementById("graph-equation");
const solutionSteps = document.getElementById("solution-steps");
const solutionContainer = document.getElementById("solution-container");
const graphEquationContainer = document.getElementById("graph-equation-container");

setTimeout(function () {
    if (queryInput.value) {
        processQuery(queryInput.value)
    }
}, 0);

queryForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const query = queryInput.value;
    processQuery(query);

    return false;
});

function processQuery(query) {
    const ast = getAST(query);
    // console.dir(ast);

    const out = ast.getHTML();
    inputInterpretation.innerHTML = out;

    if (query.includes('x') || query.includes('y')) {
        try {
            let glslExpression;
            let graphableAst = ast;

            if (!(ast instanceof ItemTypes.BinaryOperator && ast.value === '=')) {
                //only one side is written, so I make a guess at the missing half

                if (query.includes('x') && query.includes('y')) {
                    graphableAst = new ItemTypes.BinaryOperator("=", ast, new ItemTypes.Number(1.0));
                } else if (query.includes('y')) {
                    graphableAst = new ItemTypes.BinaryOperator("=", new ItemTypes.Variable("x"), ast);
                } else {
                    graphableAst = new ItemTypes.BinaryOperator("=", new ItemTypes.Variable("y"), ast);
                }
            }

            glslExpression = graphableAst.right.getGLSL() + " - (" + graphableAst.left.getGLSL() + ")";
            if (graphableAst === ast) {
                graphEquationContainer.style.display = "none";
            } else {
                graphEquation.innerHTML = graphableAst.getHTML();
                graphEquationContainer.style.display = "";
            }
            enableGraph(glslExpression);
        } catch (e) {
            console.error(e);
        }
    }
    else {
        disableGraph();
        graphEquationContainer.style.display = "none";
    }

    //simplify the expression and print each step of the simplification
    //stop when the resulting expression is the same as the previous step
    solutionSteps.innerHTML = "";

    let previousHTML = "";
    let simplifiedAst = ast;
    let failedToSolve = false;

    for (let i = 0; ; ++i) {
        const html = simplifiedAst.getHTML();
        if (html === previousHTML) {
            break;
        }

        if (i > 20) {
            failedToSolve = true;
            break;
        }

        const step = document.createElement("div");
        step.innerHTML = simplifiedAst.getTreeHTML();
        step.classList.add("formula-display");
        solutionSteps.appendChild(step);

        previousHTML = html;
        simplifiedAst = simplifiedAst.simplify();
    }

    //don't show the solution box if there is no solution,
    //solution cannot be found (likely due to lack of implementation),
    //or the input is already in its simpliest form
    // if (solutionSteps.childNodes.length <= 1 || failedToSolve) {
    //     solutionContainer.style.display = "none";
    // } else {
    solutionContainer.style.display = "";
    // }
}

function getAST(expressionString) {
    const tokens = expressionString.match(/\d+[.]?\d*|\d*[.]?\d+|cos|sin|tan|abs|floor|theta|pi|[a-zπΠΘθ]|[-=+*^\\/()]/gi);

    if (!tokens || tokens.length === 0) {
        return new ItemTypes.ASTNode();
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
        let item;

        if (op === '/') {
            item = new ItemTypes.Ratio()
        } else {
            item = new ItemTypes.BinaryOperator(op)
        }

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
        if (/\d+|cos|sin|tan|abs|floor|theta|pi|[a-zπΠΘθ]/i.test(token)) {
            if (i > 0 && /\d+|theta|pi|[a-zπΠΘθ]/i.test(tokens[i - 1])) {
                handleOperator('*');
            }
        }

        if (/cos|sin|tan|abs|floor/i.test(token)) {
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
                // console.log("I think there is a function-style multiplication going on here.", expression, opStack);
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