vim.g.mapleader = " "

local keymap = vim.keymap.set
local opts = { noremap = true, silent = true }

-- Splits
keymap("n", "<leader>v", ":vsplit<CR>", opts)
keymap("n", "<leader>s", ":split<CR>", opts)

-- Select All
keymap("n", "<leader>a", "ggVG", opts)

-- Copy and Paste
keymap("n", "<leader>yy", '"+yy', opts)
keymap("v", "<leader>y", '"+y', opts)

-- Panes
keymap("n", "<leader>h", "<C-w>h", opts)
keymap("n", "<leader>j", "<C-w>j", opts)
keymap("n", "<leader>k", "<C-w>k", opts)
keymap("n", "<leader>l", "<C-w>l", opts)

-- Save / quit
keymap("n", "<leader>w", ":w<CR>", opts)
keymap("n", "<leader>q", ":q<CR>", opts)
keymap("n", "<leader>x", ":x<CR>", opts)

-- Keep cursor centered when half-page jumping
keymap("n", "<C-d>", "<C-d>zz", opts)
keymap("n", "<C-u>", "<C-u>zz", opts)

-- Visual mode
-- Stay in visual mode while indenting
keymap("v", "<", "<gv", opts)
keymap("v", ">", ">gv", opts)

-- Move selected lines
keymap("v", "J", ":m '>+1<CR>gv=gv", opts)
keymap("v", "K", ":m '<-2<CR>gv=gv", opts)

keymap("i", "<C-BS>", "<C-w>", { noremap = true })

-- Normal mode toggle comment
keymap("n", "<C-/>", function()
	require("Comment.api").toggle.linewise.current()
end, { noremap = true, silent = true })

-- Visual mode toggle comment
keymap("v", "<C-/>", function()
	local esc = vim.api.nvim_replace_termcodes("<ESC>", true, false, true)
	vim.api.nvim_feedkeys(esc, "nx", false)
	require("Comment.api").toggle.linewise(vim.fn.visualmode())
end, { noremap = true, silent = true })
