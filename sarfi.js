/**
 * My version of React followed using https://pomb.us/build-your-own-react/
 * Followed : https://github.com/pomber/didact
 */

// Step 1 : Creating the createElement function
/**
 * const element = (
 *  <div id="foo">
 *   <a>bar</a>
 *   <b />
 *  </div>
 * )
 *  
 */
function createElement(
    type,
    props,
    ...children
) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child =>
                typeof child === "object"
                    ? child
                    : createTextElement(child)
            ),
        }
    }
};

function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: [],
        },
    }
}


function commitRoot() {
    // TODO add nodes to dom
    console.log("commitRoot", wipRoot);
    deletions.forEach(commitWork);
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
}

const isEvent = key => key.startsWith("on");
const isProperty = key => key !== "children" && !isEvent(key);
const isNew = (prev, next) => key =>
    prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);
function updateDom(dom, prevProps, nextProps) {
    console.log("updateDom", dom, prevProps, nextProps);

    if (prevProps === undefined || nextProps == undefined) { 
        return;
    }

    // TODO remove old or changed event listeners
    // TODO remove old properties
    // TODO set new or changed properties

    // ? Removing old or changed event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(
            key =>
                !(key in nextProps) ||
                isNew(prevProps, nextProps)(key)
    ).forEach(name => {
        const eventType = name.toLowerCase().substring(2);
        dom.removeEventListener(
            eventType,
            prevProps[name]
        );
    })

    // ? Setting new or changed event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(
                eventType,
                nextProps[name]
            );
        })
    



    // ? Removing old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(
            isGone(prevProps, nextProps)
    ).forEach(name => { 
        dom[name] = "";
    })

    // ? Setting new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(
            isNew(prevProps, nextProps)
        ).forEach(name => {
            dom[name] = nextProps[name];
        })
    
    
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }

    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if (
        fiber.effectTag === "PLACEMENT" &&
        fiber.dom != null
    ) {
        domParent.appendChild(fiber.dom)
    } else if (
        fiber.effectTag === "UPDATE" &&
        fiber.dom != null
    ) {
        updateDom(
            fiber.dom,
            fiber.alternate.props,
            fiber.props
        )
    } else if (fiber.effectTag === "DELETION") {
        commitDeletion(fiber, domParent)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitDeletion (fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom);
    } else {
        commitDeletion(fiber.child, domParent);
    }
}


/**
 * ? Step 3: Concurrent Mode
 * 
 * ? Once we start rendering, we won’t stop until we have rendered the complete element tree.
 * ? browser needs to do high priority stuff like handling user input or keeping an animation smooth
*/

// Interrupting the render function
let nextUnitOfWork = null;

let wipRoot = null;
let currentRoot = null;
let deletions = null;
let wipFiber = null;
let hookIndex = null;

function workLoop(deadline) {
    console.log("workLoop", deadline);
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
        console.log("performUnitOfWork Function", nextUnitOfWork);
        nextUnitOfWork = performUnitOfWork(
            nextUnitOfWork
        )
        console.log("nextUnitOfWork", nextUnitOfWork);
        shouldYield = deadline.timeRemaining() < 1;
    }   

    if (!nextUnitOfWork && wipRoot) { 
        console.log("commitRoot Function");
        commitRoot();
    }

    requestIdleCallback(workLoop);
}

// Run the workLoop function
requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
    
    const isFunctionComponent = fiber.type instanceof Function;
    if (isFunctionComponent) { 
        updateFunctionComponent(fiber);
    } else {
        updateHostComponent(fiber);
    }


    
    // Finding the next unit of work
    if(fiber.child) {
        return fiber.child;
    }
    let nextFiber = fiber;

    while (nextFiber) {
        if (nextFiber.sibling) {
            console.log("nextFiber.sibling", nextFiber.sibling);
            return nextFiber.sibling;

        }
        
        nextFiber = nextFiber.parent;
    }

    console.log("nextFiber", nextFiber);

}

function updateFunctionComponent(fiber) {
    wipFiber = fiber;
    hookIndex = 0;
    wipFiber.hooks = [];
    const children = [fiber.type(fiber.props)];
    reconcileChildren(fiber, children);
}

function updateHostComponent(fiber) {
    if (!fiber.dom) { 
        fiber.dom = createDom(fiber);
    }
    reconcileChildren(fiber, fiber.props.children);
}

// Step 4 Part - Fiber
function createDom(fiber) {
    const dom = fiber.type == "TEXT_ELEMENT" ?
        document.createTextNode("") :
        document.createElement(fiber.type);

    // ? Assigning the props to the dom
    updateDom(dom, {}, fiber.props)

    return dom;
}

function useState(initial) {
    // TODO
    const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex];
    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: []
    };

    const actions = oldHook ? oldHook.queue : [];
    actions.forEach(action => {
        hook.state = action(hook.state);
    })

    const setState = action => { 
        hook.queue.push(action);
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot
        }
        nextUnitOfWork = wipRoot;
        deletions = [];
    }

    wipFiber.hooks.push(hook);
    hookIndex++;

    return [hook.state, setState];
}

function reconcileChildren(wipFiber, elements) { 
    let index = 0
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null

    // Creating the new fibers
    while (
        index < elements.length || 
        oldFiber != null
    ) {

        const element = elements[index]
        let newFiber = null;

        const sameType = oldFiber && element && element.type == oldFiber.type;

        if (sameType) { 
            // TODO update the node
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: 'UPDATE'
            }
        }

        if (element && !sameType) {
            // TODO add this node
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: 'PLACEMENT'
            }
        }

        if (oldFiber && !sameType) { 
            // TODO delete the oldFiber's node
            oldFiber.effectTag = 'DELETION';
            deletions.push(oldFiber);
        }


        // ? Setting the sibling
        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }


        if (index === 0) {
            wipFiber.child = newFiber;
        } else if (element) {
            prevSibling.sibling = newFiber;
        }

        prevSibling = newFiber;
        index++;
    }




}

/**
 * ? Step 2: Creating the render function
 */
function render(element, container) { 
    console.log(element);
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot
    }
    deletions = [];
    nextUnitOfWork = wipRoot;
}

/**
 * ? Step 4: Fibers
 * ? To Organize the units of work we'll use a data structure called a fiber
 */

const Sarfi = {
    createElement,
    render,
    useState
}


