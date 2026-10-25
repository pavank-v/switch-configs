return {
	{
		"nvim-telescope/telescope.nvim",
		tag = "0.1.8",
		dependencies = { "nvim-lua/plenary.nvim" },
		lazy = false,
		config = function()
			local telescope = require("telescope")
			local builtin = require("telescope.builtin")
			local actions = require("telescope.actions")

			telescope.setup({
				defaults = {
					file_ignore_patterns = { "node_modules", ".git/", "venv/", "env/" },
					mappings = {
						i = {
							["<C-j>"] = function(prompt_bufnr)
								actions.move_selection_next(prompt_bufnr)
							end,
							["<C-k>"] = function(prompt_bufnr)
								actions.move_selection_previous(prompt_bufnr)
							end,
						},
					},
				},
				pickers = {
					find_files = {
						hidden = false,
						cwd = vim.fn.getcwd(),
					},
				},
			})

			vim.keymap.set("n", "<leader>f", builtin.find_files, { desc = "Find Files in project" })
			vim.keymap.set("n", "<leader>g", builtin.live_grep, { desc = "Live Grep in project" })
		end,
	},
	{
		"nvim-telescope/telescope-ui-select.nvim",
		config = function()
			local telescope = require("telescope")
			local actions = require("telescope.actions")

			telescope.setup({
				defaults = {
					mappings = {
						i = {
							["<C-j>"] = function(prompt_bufnr)
								actions.move_selection_next(prompt_bufnr)
							end,
							["<C-k>"] = function(prompt_bufnr)
								actions.move_selection_previous(prompt_bufnr)
							end,
						},
					},
				},
				extensions = {
					["ui-select"] = require("telescope.themes").get_dropdown({}),
				},
			})

			-- load extension *after* setup
			telescope.load_extension("ui-select")
		end,
	},
}
