// src/App.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { faker } from '@faker-js/faker';
import './App.css';

function App() {
  // Data states
  const [originalData, setOriginalData] = useState([]);
  const [currentData, setCurrentData] = useState([]);
  const [edits, setEdits] = useState(new Map());
  const [loading, setLoading] = useState(false);

  // UI states
  const [filterText, setFilterText] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [yearRange, setYearRange] = useState({ min: 0, max: 9999 });
  const [showOnlyEdited, setShowOnlyEdited] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Columns definition
  const columns = ['Title', 'Author', 'Genre', 'PublishedYear', 'ISBN'];

  // Generate sample book data
  const generateBookData = useCallback((count = 10000) => {
    const genres = [
      'Science Fiction', 'Fantasy', 'Mystery', 'Romance', 'Non-fiction',
      'History', 'Biography', 'Self-help', 'Children', 'Horror'
    ];

    const books = [];
    for (let i = 0; i < count; i++) {
      books.push({
        id: i + 1,
        Title: faker.lorem.words({ min: 1, max: 5 }),
        Author: `${faker.person.firstName()} ${faker.person.lastName()}`,
        Genre: genres[Math.floor(Math.random() * genres.length)],
        PublishedYear: faker.number.int({ min: 1800, max: 2023 }),
        ISBN: faker.commerce.isbn(13)
      });
    }
    return books;
  }, []);

  // Convert books to CSV format
  const booksToCSV = useCallback((books) => {
    const headers = ['Title', 'Author', 'Genre', 'PublishedYear', 'ISBN'];
    const csvRows = [headers.join(',')];
    
    books.forEach(book => {
      const row = headers.map(header => {
        const value = book[header];
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data.map((row, index) => ({
          id: index + 1,
          Title: row.Title || '',
          Author: row.Author || '',
          Genre: row.Genre || '',
          PublishedYear: parseInt(row.PublishedYear) || 0,
          ISBN: row.ISBN || ''
        }));
        
        setOriginalData(parsedData);
        setCurrentData(parsedData);
        setEdits(new Map());
        setLoading(false);
        setCurrentPage(1);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setLoading(false);
        alert('Error parsing CSV file. Please check the format.');
      }
    });
  }, []);

  // Generate sample data
  const handleGenerateData = useCallback(async (count = 10000) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const data = generateBookData(count);
      setOriginalData(data);
      setCurrentData(data);
      setEdits(new Map());
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [generateBookData]);

  // Update cell value
  const handleCellEdit = useCallback((rowIndex, column, value) => {
    setCurrentData(prevData => {
      const newData = [...prevData];
      const updatedRow = { ...newData[rowIndex], [column]: value };
      newData[rowIndex] = updatedRow;
      
      setEdits(prevEdits => {
        const newEdits = new Map(prevEdits);
        const originalRow = originalData[rowIndex];
        
        const hasChanges = columns.some(col => 
          String(updatedRow[col] || '') !== String(originalRow?.[col] || '')
        );
        
        if (hasChanges) {
          newEdits.set(rowIndex, updatedRow);
        } else {
          newEdits.delete(rowIndex);
        }
        
        return newEdits;
      });
      
      return newData;
    });
  }, [originalData, columns]);

  // Reset all edits
  const handleResetEdits = useCallback(() => {
    setCurrentData([...originalData]);
    setEdits(new Map());
  }, [originalData]);

  // Download CSV
  const handleDownloadCSV = useCallback(() => {
    const csvContent = booksToCSV(currentData);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited_books.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [currentData, booksToCSV]);

  // Handle sorting
  const handleSort = useCallback((key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = currentData;

    if (filterText) {
      const searchText = filterText.toLowerCase();
      filtered = filtered.filter(book =>
        Object.values(book).some(value =>
          String(value).toLowerCase().includes(searchText)
        )
      );
    }

    if (filterGenre) {
      filtered = filtered.filter(book => book.Genre === filterGenre);
    }

    filtered = filtered.filter(book =>
      book.PublishedYear >= yearRange.min && book.PublishedYear <= yearRange.max
    );

    if (showOnlyEdited) {
      filtered = filtered.filter((_, index) => edits.has(index));
    }

    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [currentData, filterText, filterGenre, yearRange, showOnlyEdited, sortConfig, edits]);

  // Get unique genres
  const genres = useMemo(() => {
    const genreSet = new Set(currentData.map(book => book.Genre).filter(Boolean));
    return Array.from(genreSet).sort();
  }, [currentData]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  // Check if a cell is edited
  const isCellEdited = useCallback((rowIndex, column) => {
    if (rowIndex >= originalData.length) return false;
    const originalValue = originalData[rowIndex]?.[column] || '';
    const currentValue = currentData[rowIndex]?.[column] || '';
    return String(originalValue) !== String(currentValue);
  }, [originalData, currentData]);

  // File input change handler
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <h1>Book CSV Editor</h1>
            <p>Upload, edit, and manage your book collection</p>
          </div>
        </header>

        {/* Main Actions */}
        <div className="actions-section">
          <div className="action-buttons">
            <label className="file-upload-btn">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="file-input"
              />
              📁 Upload CSV
            </label>
            
            <button
              onClick={() => handleGenerateData(10000)}
              className="btn btn-generate"
              disabled={loading}
            >
              {loading ? '⏳ Generating...' : '⚡ Generate 10k Data'}
            </button>
            
            <button
              onClick={handleDownloadCSV}
              disabled={currentData.length === 0}
              className="btn btn-download"
            >
              💾 Download CSV
            </button>
            
            <button
              onClick={handleResetEdits}
              disabled={edits.size === 0}
              className="btn btn-reset"
            >
              🔄 Reset Edits
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading data...</p>
          </div>
        )}

        {currentData.length > 0 ? (
          <>
            {/* Filters */}
            <div className="filters-section">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="🔍 Search books..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="filter-controls">
                <select
                  value={filterGenre}
                  onChange={(e) => setFilterGenre(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Genres</option>
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>

                <div className="year-filter">
                  <input
                    type="number"
                    placeholder="From year"
                    value={yearRange.min || ''}
                    onChange={(e) => setYearRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                    className="year-input"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    placeholder="To year"
                    value={yearRange.max === 9999 ? '' : yearRange.max}
                    onChange={(e) => setYearRange(prev => ({ ...prev, max: parseInt(e.target.value) || 9999 }))}
                    className="year-input"
                  />
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showOnlyEdited}
                    onChange={(e) => setShowOnlyEdited(e.target.checked)}
                  />
                  Show edited only
                </label>
              </div>

              {/* Stats */}
              <div className="stats">
                <span>Total: {currentData.length}</span>
                <span>Filtered: {filteredData.length}</span>
                <span>Edited: {edits.size}</span>
                <span>Page: {currentPage} of {totalPages}</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {columns.map(column => (
                      <th 
                        key={column}
                        onClick={() => handleSort(column)}
                        className="sortable"
                      >
                        {column}
                        {sortConfig.key === column && (
                          <span>{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, index) => {
                    const absoluteIndex = startIndex + index;
                    const isEdited = edits.has(absoluteIndex);
                    
                    return (
                      <tr key={absoluteIndex} className={isEdited ? 'edited-row' : ''}>
                        <td className="row-number">{absoluteIndex + 1}</td>
                        {columns.map(column => {
                          const cellEdited = isCellEdited(absoluteIndex, column);
                          
                          return (
                            <td key={column} className={cellEdited ? 'edited-cell' : ''}>
                              <input
                                value={row[column] || ''}
                                onChange={(e) => handleCellEdit(absoluteIndex, column, e.target.value)}
                                className="cell-input"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <div className="pagination-info">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} books
              </div>
              
              <div className="pagination-controls">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                  className="page-size-select"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>

                <div className="page-buttons">
                  <button 
                    onClick={() => setCurrentPage(1)} 
                    disabled={currentPage === 1}
                    className="page-btn"
                  >
                    First
                  </button>
                  <button 
                    onClick={() => setCurrentPage(currentPage - 1)} 
                    disabled={currentPage === 1}
                    className="page-btn"
                  >
                    Previous
                  </button>
                  
                  <span className="page-info">Page {currentPage} of {totalPages}</span>
                  
                  <button 
                    onClick={() => setCurrentPage(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    className="page-btn"
                  >
                    Next
                  </button>
                  <button 
                    onClick={() => setCurrentPage(totalPages)} 
                    disabled={currentPage === totalPages}
                    className="page-btn"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          !loading && (
            <div className="empty-state">
              <div className="empty-content">
                <div className="empty-icon">📚</div>
                <h2>Welcome to Book Editor</h2>
                <p>Get started by uploading a CSV file or generating sample data</p>
                <div className="empty-actions">
                  <label className="btn btn-primary">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="file-input"
                    />
                    Upload CSV File
                  </label>
                  <button
                    onClick={() => handleGenerateData(10000)}
                    className="btn btn-secondary"
                  >
                    Generate Sample Data
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default App;