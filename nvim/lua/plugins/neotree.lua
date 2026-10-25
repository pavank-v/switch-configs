return {
	"nvim-neo-tree/neo-tree.nvim",
	branch = "v3.x",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"MunifTanjim/nui.nvim",
		"nvim-tree/nvim-web-devicons",
	},
	lazy = false,

	config = function()
		local neotree = require("neo-tree")

		neotree.setup({
			close_if_last_window = true,
			popup_border_style = "rounded",
			enable_git_status = true,
			filesystem = {
				filtered_items = {
					visible = true,
					hide_dotfiles = false,
					hide_gitignored = false,
				},
			},
			enable_diagnostics = true,
			window = {
				width = 25,
			},
		})

		vim.keymap.set("n", "<C-e>", ":Neotree toggle filesystem left<CR>", { desc = "Neotree filesystem" })
		vim.keymap.set("n", "<leader>b", ":Neotree toggle buffers<CR>", { desc = "NeoTree Buffers" })
		vim.keymap.set("n", "<C-g>", ":Neotree toggle git_status<CR>", { desc = "NeoTree Git" })
	end,
}
