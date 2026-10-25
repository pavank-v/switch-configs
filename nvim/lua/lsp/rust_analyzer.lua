return {
  cmd = { 'rust-analyzer' },
  filetypes = { 'rust' },
  root_markers = {
    { 'Cargo.toml', 'rust-project.json' },
    '.git'
  },
  settings = {
    ['rust-analyzer'] = {
      cargo = {
        allFeatures = true,
        loadOutDirsFromCheck = true,
        buildScripts = {
          enable = true,
        },
      },
      checkOnSave = {
        command = 'clippy',
      },
      procMacro = {
        enable = true,
      },
      inlayHints = {
        lifetimeElisionHints = {
          enable = 'always',
        },
      },
    }
  }
}
