-- LSP Keymaps

vim.api.nvim_create_autocmd('LspAttach', {
  group = vim.api.nvim_create_augroup('lsp-keymaps', { clear = true }),
  callback = function(ev)
    local opts = { buffer = ev.buf, noremap = true, silent = true }

    -- Helper function to set keymaps with descriptions
    local function map(mode, lhs, rhs, desc)
      local map_opts = vim.tbl_extend('force', opts, { desc = desc })
      vim.keymap.set(mode, lhs, rhs, map_opts)
    end

    -- Navigation
    map('n', 'gd', vim.lsp.buf.definition, 'Go to definition')
    map('n', 'gD', vim.lsp.buf.declaration, 'Go to declaration')
    map('n', 'gt', vim.lsp.buf.type_definition, 'Go to type definition')

    -- Information
    map('n', 'gh', vim.lsp.buf.hover, 'Show hover information')

    -- Code Actions
    map('n', '<leader>ca', vim.lsp.buf.code_action, 'Code action')
    map('v', '<leader>ca', vim.lsp.buf.code_action, 'Code action')

    -- Refactoring
    map('n', '<leader>rn', vim.lsp.buf.rename, 'Rename symbol')
    map('n', '<leader>p', function() vim.lsp.buf.format { async = true }
    end, 'Format code')

    -- Diagnostics
    map('n', '[d', vim.diagnostic.goto_prev, 'Previous diagnostic')
    map('n', ']d', vim.diagnostic.goto_next, 'Next diagnostic')
    map('n', '<leader>e', vim.diagnostic.open_float, 'Show diagnostic')
  end,
})

-- Optional: Configure diagnostic display
vim.diagnostic.config({
  virtual_text = true,
  signs = true,
  underline = true,
  update_in_insert = false,
  severity_sort = true,
  float = {
    border = 'rounded',
    source = 'always',
    header = '',
    prefix = '',
  },
})

-- Optional: Configure LSP UI
vim.lsp.handlers['textDocument/hover'] = vim.lsp.with(
  vim.lsp.handlers.hover,
  { border = 'rounded' }
)

vim.lsp.handlers['textDocument/signatureHelp'] = vim.lsp.with(
  vim.lsp.handlers.signature_help,
  { border = 'rounded' }
)

-- Optional: Diagnostic signs
local signs = { Error = "󰅚 ", Warn = "󰀪 ", Hint = "󰌶 ", Info = " " }
for type, icon in pairs(signs) do
  local hl = "DiagnosticSign" .. type
  vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = hl })
end
