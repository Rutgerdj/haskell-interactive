import * as vscode from 'vscode';
import * as path from 'path';
import { kMaxLength } from 'buffer';

export function activate(context: vscode.ExtensionContext) {


	let compile_haskell = vscode.commands.registerCommand("haskell-interactive.compile_program", () => {
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		let filename = editor.document.fileName;
		let dirname = path.dirname(filename);
		let terminal = getTerminal("run_tests");
		terminal.sendText(`cd ${dirname}`);

		let config = vscode.workspace.getConfiguration();
		let targetFile = config.get("haskell-interactive.targetFile") as string;
		terminal.sendText(`ghc --make ${filename} -no-keep-o-files -no-keep-hi-files -o ${path.join(dirname, targetFile)}`);

		returnFocus();

	});

	let run_tests = vscode.commands.registerCommand("haskell-interactive.run_test", () => {
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		let filename = editor.document.fileName;
		let dirname = path.dirname(filename);
		let config = vscode.workspace.getConfiguration("haskell-interactive");
		let testsFolder = config.get("testFolder") as string;
		if (path.basename(dirname) === testsFolder){
			dirname = path.dirname(dirname);
		}
		let testsPath =path.join(dirname, testsFolder);

		vscode.workspace.fs.readDirectory(vscode.Uri.file(testsPath)).then((x) => {

			let files = x.map(x => x[0]);
			let inFiles = files.filter(x => x.endsWith(".in"));

			vscode.window.showQuickPick(inFiles, { placeHolder: "Select an input file:" }).then((x) => {
				if (!x) {
					return;
				}

				let terminal = getTerminal("run_tests");
				terminal.sendText(`cd ${dirname}`);
				let name = x?.replace(".in", "");

				let targetFile = config.get("targetFile") as string;

				name = path.join(testsFolder, name);

				// terminal.sendText(`./${targetFile} < ${name}.in > ${name}.out 2>&1`);
				terminal.sendText(`cat ${name}.in | ./${targetFile} > ${name}.out 2>&1`);
				if (files.indexOf(`${path.basename(name)}.exp`) >= 0){
					terminal.sendText(`code --diff ${name}.out ${name}.exp`);
				}else{
					terminal.sendText(`code ${name}.out`);
				}

			});

		});
	});

	let run_haskell_terminal = vscode.commands.registerCommand('haskell-interactive.run_haskel_terminal', () => {

		var editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		var terminal = getTerminal();

		if (editor.selection.isEmpty) {

			let parts = editor.document.lineAt(editor.selection.start.line).text.split(" ");
			let excludedFunctions = vscode.workspace.getConfiguration("haskell-interactive").get("excludedFunctionNames") as Array<string>;

			var selection = findMultiLines(editor);

			if (selection.max - selection.min === 0 || excludedFunctions.indexOf(parts[0]) >= 0) {
				var text = editor.document.lineAt(editor.selection.start.line).text;
				sendTextToGhci(text, terminal, false);
			} else {

				var pos1 = new vscode.Position(selection.min, 0);
				var pos2 = new vscode.Position(selection.max, editor.document.lineAt(selection.max).text.length);
				var range = new vscode.Range(pos1, pos2);
				text = editor.document.getText(range);
				sendTextToGhci(text, terminal, true);

			}
		}
		else {
			var text = editor.document.getText(editor.selection);
			if (!text) {
				return;
			}

			sendTextToGhci(text, terminal, true);
		}

		returnFocus();

	});
	context.subscriptions.push(run_tests);
	context.subscriptions.push(compile_haskell);
	context.subscriptions.push(run_haskell_terminal);
}

function returnFocus(){
	let config = vscode.workspace.getConfiguration("haskell-interactive");
	
	if (config.get("returnFocus") === "editor") {
		setTimeout(() => {
			vscode.window.activeTextEditor?.show();
		}, 50);
	}
}

function getTerminal(name: string = "haskell-interactive") {
	let config = vscode.workspace.getConfiguration("haskell-interactive")
	if (config.get("findSharedTerminals")){
		var terminal = vscode.window.terminals.filter((x) => x.name.replace(" [Shared]", "") === name)[0];
	}else{
		var terminal = vscode.window.terminals.filter((x) => x.name === name)[0];
	}
	
	if (!terminal) {
		terminal = vscode.window.createTerminal(name);
		if (name === "haskell-interactive") {
			terminal.sendText("ghci");
		}
	}
	terminal.show();
	return terminal;
}

function sendTextToGhci(text: string, terminal: vscode.Terminal, isMultiline: boolean = true) {

	if (isMultiline) {
		text = ":{\n" + text.trim() + "\n:}";
	}
	terminal.sendText(text);
}

function findMultiLines(editor: vscode.TextEditor) {
	let start = editor.selection.start.line;
	var tabsize = editor.options.tabSize as number;
	let min = start;

	while (min > 0) {
		var line = editor.document.lineAt(min).text;
		let startWithTab = line.startsWith(" ".repeat(tabsize));

		if (!startWithTab || line === "") {
			break;
		}
		min--;
	}
	var max = start;
	while (max < editor.document.lineCount - 1) {
		var line = editor.document.lineAt(max + 1).text;
		let startWithTab = line.startsWith(" ".repeat(tabsize));
		if (!startWithTab || line === "") {
			break;
		}
		max++;
	}

	let parts = editor.document.lineAt(min).text.split(" ");
	if (parts.length > 1) {
		let funcName = parts[0];

		while (min > 0) {
			let line = editor.document.lineAt(min - 1).text;
			if (line === "") { break; }

			let parts = line.split(" ");
			if (parts.length > 1 && parts[0] !== funcName) { break; }

			min--;
		}
		
		while (max < editor.document.lineCount - 1) {
			let line = editor.document.lineAt(max + 1).text;
			if (line === "") { break; }

			let parts = line.split(" ");
			if ((parts.length > 1 && parts[0] !== funcName) && (!line.startsWith(" ".repeat(tabsize)))) {
				break;
			}
			max++;
		}
	}

	// console.log(editor.document.lineAt(min - 1).text);
	return { "min": min, "max": max };
}

// this method is called when your extension is deactivated
export function deactivate() { }
