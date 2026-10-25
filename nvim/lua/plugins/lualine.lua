return {
    'nvim-lualine/lualine.nvim',
    dependencies = { 'nvim-tree/nvim-web-devicons' },
    lazy = false,
    config = function()
        require('lualine').setup({
            options = {
                theme = 'iceberg', 
                component_separators = '|',
                section_separators = { left = '', right = '' },
                globalstatus = true,
            },
        })
    end
}
