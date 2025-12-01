var shellHistory = {
	commands: [],
	current: -1
}

// Globals come here
var ShellEnvironment = {
	RETROAI_API_URL: "https://llm.luizpuglisi.me/v1",
	RETROAI_API_PATH: "/chat/completions",
	RETROAI_API_KEY: null,
	RETROAI_API_TEMPERATURE: 0.8,
	RETROAI_API_STREAM_LIMIT: -1,
	RETROAI_STATUS_THINKING: "RetroAI is thinking... Press [Ctrl-C]; to abort.",
	RETROAI_STATUS_DONE: "Your data is ready.",
	RETROAI_EXIT_URL: "https://www.google.com",
	PATH: "/",
	COLORSCHEME: "default"
}

var cancelRequested = false;

// This one right here is nice
const RetroAICommands = {
	TermInput:  null,
	TermOutput: null,

	ask: {
		help: "asks AI for something - <b>ask</b> PROMPT",
		f: async (args) => {
			await RetroAICommands.prompt.f("What/why is " + args);
		}
	},

	clear: {
		help: "clears the screen",
		f: (args) => {
			RetroAICommands.TermOutput.innerHTML = "";
			RetroAICommands.TermInput.value = "";
		}
	},

	env: {
		help: "shows the environment variables",
		f: (args) => {
			Object.entries(ShellEnvironment).forEach(([k, v]) => {
				text = "<b>" + k + "</b>: " + v;
				addOutput(text, true);
			});
		}
	},

	exit: {
		help: "exits the shell",
		f: (args) => {
			this.addOutput("\nSee ya!");
			setTimeout(() => {
				location.href = ShellEnvironment.RETROAI_EXIT_URL
			}, 1500);
		}
	},

	help: {
		help: "help [command] (you're using it right now)",
		f: (args) => {
			if (args.length > 0) {
				var cmds = args.split();
				for (cmd in cmds) {
					var cmd = RetroAICommands[args];
					if (typeof cmd === "object" && typeof cmd.help === "string") {
						addOutput("<u>" + args + "</u>: " + cmd.help, true);
					} else {
						addOutput("<b>error</b>: " + cmd + ": command not found", true);
					}
				}

				return;
			} else {
				Object.entries(RetroAICommands).forEach(([k, v]) => {
					if (v && v.f && v.help) {
						addOutput("<u>" + k + "</u>: " + v.help, true);
					}
				});
			}
		}
	},

	ls: {
		help: "ls [OPTIONS]",
		f: (args) => {
			var output = ". .. <font color='#a98acc'>system user models</font>";
			addOutput(output, true);
		}
	},

	prompt: {
		help: "sends a prompt to AI - <b>prompt</b> PROMPT",
		f: async (args) => {
			if (args.length == 0) {
				addOutput("usage:\n\t\tprompt ARGS");
			} else {
				queryApi("user", args);
			}
		}
	},

	send: {
		help: "sends AI a prompt - <b>send</b> PROMPT",
		f: async (args) => {
			await RetroAICommands.prompt.f(args);
		}
	},

	set:{
		help: "sets a environment variable - <b>set</b> VAR=VALUE",
		f: (args) => {
			// Used to setup the API interface
			// args must be VAR=VALUE
			kvPair = args.split("=");
			if (kvPair.length != 2) {
				addOutput("set: wrong syntax\ntry 'set VARIABLE=VALUE'");
			} else {
				ShellEnvironment[kvPair[0]] = kvPair[1];

				addOutput(kvPair[0] + "=" + ShellEnvironment[kvPair[0]] + ", OK");

				// Apply dinamic rules for specific env vars
				if (kvPair[0] === "COLORSCHEME") {
					changeColorScheme(kvPair[1]);
				}
			}
		}
	},

	shutdown: {
		help: "try it out",
		f: (args) => {
			addOutput("I'm not shutting down just because you want.");
		}
	},

	system:{
		help: "sends a system prompt to AI - <b>system</b> PROMPT",
		f: async (args) => {
			if (args.length == 0) {
				addOutput("usage:\n\t\tsystem ARGS");
			} else {
				queryApi("system", args);
			}
		}
	},

	whereis: {
		help: "whereis ARG",
		f: (args) => {
			addOutput("whereis: curiosity killed the cat.");
		}
	}
};

function changeColorScheme(scheme) {
	var link = document.getElementById("colorscheme");
	if (link == null) {
		return;
	}

	link.href = "/assets/css/" + scheme + ".css?" + Math.random();
}

function addOutput(text, html = false, newline = true) {
	const to = RetroAICommands.TermOutput;

	if (!to) {
		return;
	}

	const value = text;

	// add PS1 to output
	if (html)
	{
		to.innerHTML += text;
		if (newline)
		{
			to.innerHTML += "<br/>";
		}
	}
	else
	{
		to.innerText += text;
		if (newline)
		{
			to.innerText += "\n";
		}
	}

	const scrollHeight = document.body.scrollHeight;
	window.scrollTo({
  	left: 0,
  	top: scrollHeight,
  	behavior: "smooth"
	});
}

function banner() {
	var banner = "Type <b>help</b> to begin (or just &lt;Tab&gt; your way through)";
	addOutput(banner, true);
}

function updateStatus(text) {
	const ti = RetroAICommands.TermInput;
	if (!ti) {
		return;
	}

	ti.placeholder = text;
}

async function queryApi(role, args) {
	try {
		// -- Some good work happening here
		addOutput("<br/><span class='aiChatStart'>AI chat started</span> [" + role + "]<br/>", true)
		updateStatus(ShellEnvironment.RETROAI_STATUS_THINKING);

		console.log("args is " + args);

		await sendAPIRequest(role, args);
	}
	catch (e)
	{
		if (e.message) {
			addOutput("<b>error</b>: " + e.message, true);
		} else {
			addOutput("<b>error</b>: " + e, true);
		}
	}

	updateStatus(ShellEnvironment.RETROAI_STATUS_DONE);
	setTimeout(() => { updateStatus("") }, 3000);
}

async function sendAPIRequest(role, args) {
	try {
		var error = null;
		const jsonParams = {
			stream: true,
			messages: [{
				role: role,
				content: args,
				n_predict: 128,
				no_perf: true
			}],
			temperature: ShellEnvironment.RETROAI_API_TEMPERATURE
		};

		apiUrl = ShellEnvironment.RETROAI_API_URL + ShellEnvironment.RETROAI_API_PATH;
		apiHeaders = {
			"Accept": "text/event-stream",
			"Accept": "application/json",
			"Content-Type": "application/json"
		}

		if (ShellEnvironment.RETROAI_API_KEY != null &&
				ShellEnvironment.RETROAI_API_KEY.length > 0) {
			apiHeaders["Authorization"] = "Bearer " + ShellEnvironment.RETROAI_API_KEY;
		}

		fetchArgs = {
			method: "POST",
			headers: apiHeaders,
			body: JSON.stringify(jsonParams)
		};

		const response = await fetch(apiUrl, fetchArgs);

		if (response.ok) {
			const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
			var ts = 0;

			cancelRequested = false;
			while (true && !cancelRequested) {
				const {value, done} = await reader.read();
				if (done) {
					break;
				}

				// value is in the form 'data: {JSON}', but JSON.parse does not
				// understand it
				try
				{
					// A hell of a workaround
					const jsonData = value.toString().split(/data\:\s*/i);
					for (const data of jsonData)
					{
						console.log(data);
						if (data.length == 0) {
							continue;
						}

						json = JSON.parse(data);
						if (json.choices && json.choices.length > 0)
						{
							if (json.choices[0].delta)
							{
								var content = json.choices[0].delta.content;
								if (! content) {
									continue;
								}

								content = content.replace("\n", "<br/>");
								content = content.replace("\r", "<br/>");

								addOutput(content, true, false);
							}
						}
					}
				}
				catch (e)
				{
					console.error(e);
				}

				if (ShellEnvironment.RETROAI_API_STREAM_LIMIT > 0 &&
					++ts > ShellEnvironment.RETROAI_API_STREAM_LIMIT)
				{
					break;
				}
			}

			await reader.cancel();

			cancelRequested = false;
		} else {
			error = "error from the API";
		}
	} catch(e) {
		error = e.message;
	}

  if (error) {
    addOutput("<b>error</b>: " + error, true);
  }
}

async function handleCommand(cmd, args) {
	if (cmd.length == 0)
	{
		return false;
	}

	// add a PS1 before the command's output
	addOutput("_&gt;&nbsp;" + cmd + " " + args, true);

	const cmdobj = RetroAICommands[cmd];
	if (typeof cmdobj === "object" && typeof cmdobj.f === "function")
	{
		cmdobj.f(args);
	} else {
		addOutput(cmd + ": command not found");
	}

	return true;
}

function termInputKeyup(e)
{
	switch (e.keyCode)
	{
		case 10: case 13: // Newline or Linefeed
		{
			line = RetroAICommands.TermInput.value;

			// Add current command to shell history
			shellHistory.commands.push(line);
			shellHistory.current = -1;

			wiSpace = line.indexOf(" ");
			if (wiSpace == -1) {
				wiSpace = line.length;
			}
			command = line.substr(0, wiSpace);
			args = line.substr(wiSpace + 1);

			// handle the command
			if ( !handleCommand(command, args) ) {
				console.log("command not handled");
			}

			RetroAICommands.TermInput.value = "";
			break;
		}

		// Tab key
		case 9: {
			// Offer autocompletion
			e.preventDefault();

      if (RetroAICommands.TermInput != document.activeElement) {
        break;
      }

			validCommands = [];
			Object.entries(RetroAICommands).forEach(([k, v]) => {
				if (v && typeof v.f === "function") {
					validCommands.push(k)
				}
			});

			input = RetroAICommands.TermInput.value;
			if (input.length > 0)
			{
				index = validCommands.indexOf(input);
				if (index == -1)
				{
					for (const cmd of validCommands)
					{
						if (cmd.startsWith(input))
						{
							RetroAICommands.TermInput.value = cmd;
							break;
						}
					}
				}
				else
				{
					index = (index == validCommands.length - 1 ? 0 : index + 1);
					RetroAICommands.TermInput.value = validCommands[index];
				}
			}
			else
			{
				RetroAICommands.TermInput.value = validCommands[0];
			}

			break;
		}

		case 38: { // Up
			if (shellHistory.current == -1)
			{
				shellHistory.current = (shellHistory.commands.length - 1);
			}
			else
			{
				shellHistory.current--;
			}

			if (shellHistory.current >= 0)
			{
				RetroAICommands.TermInput.value = shellHistory.commands[shellHistory.current];
			}
			break;
		}

		case 40: { //Down
			// Current++
			if (RetroAICommands.TermInput.length == 0)
			{
				break;
			}

			if (shellHistory.current < (shellHistory.commands.length - 1))
			{
				shellHistory.current++;
			}

			RetroAICommands.TermInput.value = shellHistory.commands[shellHistory.current];
			break;
		}

		case 67: { // 'c'
			if (e.ctrlKey) {
				addOutput("");
				RetroAICommands.TermInput.value = "";
				cancelRequested = true;
			}
			break;
		}

		case 68: { // 'd'
			if (e.ctrlKey && RetroAICommands.TermInput.value == "") {
				e.preventDefault();
				RetroAICommands.exit.f();
			}
			break;
		}

		default:
		{
		}
	}
}

document.addEventListener('DOMContentLoaded', function() {
	const ti = document.getElementById('termInput');
	const to = document.getElementById('termOutput');

	RetroAICommands.TermInput = ti;
	RetroAICommands.TermOutput = to;

  if (ti) {
    ti.addEventListener('keydown', termInputKeyup);
	}

	// Add banner to TermOutput
	banner();
});

window.addEventListener('focus', () => {
  document.getElementById("termInput").focus();
});

