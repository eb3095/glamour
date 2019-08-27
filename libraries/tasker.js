exports.Task = class {

    constructor() {
        this.finished = false;
        this.tasks = 0;
        this.completed = 0;
    }

    call () {
        setTimeout(this.callback, 10);
    }

    tick () {
        this.completed++;
        if (this.tasks <= this.completed) {
            this.finished = true;
        }
    }

    waitFor() {
        wait(this);
    }
};

function wait(task) {
    if (task.finished || this.tasks === 0) {
        task.call();
    } else {
        setTimeout(wait, 10, task);
    }
}