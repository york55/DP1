import React from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'

/**
 * DataTable — thin wrapper around MUI DataGrid with consistent styling.
 */
export default function DataTable({
  rows,
  columns,
  onRowClick,
  loading = false,
  sx = {},
  ...rest
}) {
  const resizableColumns = columns.map((col) => ({
    resizable: true,
    minWidth: 60,
    ...col,
  }))

  return (
    <Box
      sx={{
        width: '100%',
        '& .MuiDataGrid-root': {
          border: '1px solid #BFBFBF',
          borderRadius: 1,
        },
        '& .MuiDataGrid-columnHeaders': {
          backgroundColor: '#D9E2F3',
          color: '#1F3864',
          fontWeight: 700,
        },
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 700,
          color: '#1F3864',
        },
        '& .MuiDataGrid-row:nth-of-type(odd)': {
          backgroundColor: '#FFFFFF',
        },
        '& .MuiDataGrid-row:nth-of-type(even)': {
          backgroundColor: '#F2F2F2',
        },
        '& .MuiDataGrid-row:hover': {
          backgroundColor: '#E8EEF7',
          cursor: onRowClick ? 'pointer' : 'default',
        },
        '& .MuiDataGrid-columnSeparator': {
          visibility: 'visible',
          color: '#BFBFBF',
        },
        '& .MuiDataGrid-columnSeparator:hover': {
          color: '#1F3864',
        },
        ...sx,
      }}
    >
      <DataGrid
        rows={rows}
        columns={resizableColumns}
        density="compact"
        initialState={{
          pagination: {
            paginationModel: { pageSize: 25 },
          },
        }}
        pageSizeOptions={[10, 25, 50]}
        autoHeight
        disableRowSelectionOnClick
        onRowClick={onRowClick}
        loading={loading}
        {...rest}
      />
    </Box>
  )
}
