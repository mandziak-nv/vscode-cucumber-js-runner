export default class TestFile {
    private _isResolved: boolean = false;

    get isResolved(): boolean {
        return this._isResolved;
    }

    public setResolved(): void {
        this._isResolved = true;
    }
}
