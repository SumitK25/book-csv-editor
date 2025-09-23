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
      'History', 'Biography', 'Self-help', 'Children', 'Horror',
      'Thriller', 'Young Adult', 'Classic', 'Poetry', 'Drama'
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
      // Simulate loading for large datasets
      await new Promise(resolve => setTimeout(resolve, 100));
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
    setCurrentData(prev => {
      const newData = [...prev];
      newData[rowIndex] = { ...newData[rowIndex], [column]: value };
      return newData;
    });

    setEdits(prev => {
      const newEdits = new Map(prev);
      const originalRow = originalData[rowIndex];
      const currentRow = { ...currentData[rowIndex], [column]: value };
      
      // Check if row has changes
      const hasChanges = Object.keys(currentRow).some(key => 
        String(currentRow[key]) !== String(originalRow[key])
      );
      
      if (hasChanges) {
        newEdits.set(rowIndex, currentRow);
      } else {
        newEdits.delete(rowIndex);
      }
      
      return newEdits;
    });
  }, [originalData, currentData]);

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

  // Handle page size change
  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = currentData;

    // Text filter
    if (filterText) {
      const searchText = filterText.toLowerCase();
      filtered = filtered.filter(book =>
        Object.values(book).some(value =>
          String(value).toLowerCase().includes(searchText)
        )
      );
    }

    // Genre filter
    if (filterGenre) {
      filtered = filtered.filter(book => book.Genre === filterGenre);
    }

    // Year range filter
    filtered = filtered.filter(book =>
      book.PublishedYear >= yearRange.min && book.PublishedYear <= yearRange.max
    );

    // Show only edited
    if (showOnlyEdited) {
      filtered = filtered.filter((_, index) => edits.has(index));
    }

    // Sorting
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

  // Get unique genres for filter dropdown
  const genres = useMemo(() => {
    const genreSet = new Set(currentData.map(book => book.Genre).filter(Boolean));
    return Array.from(genreSet).sort();
  }, [currentData]);

  // Get year range for filter inputs
  const yearRangeValues = useMemo(() => {
    const years = currentData.map(book => book.PublishedYear).filter(year => year > 0);
    if (years.length === 0) return { min: 0, max: 2023 };
    return {
      min: Math.min(...years),
      max: Math.max(...years)
    };
  }, [currentData]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  // Check if a cell is edited
  const isCellEdited = useCallback((rowIndex, column) => {
    const originalValue = originalData[rowIndex]?.[column];
    const currentValue = currentData[rowIndex]?.[column];
    return String(originalValue) !== String(currentValue);
  }, [originalData, currentData]);

  // Check if a row is edited
  const isRowEdited = useCallback((rowIndex) => {
    return edits.has(rowIndex);
  }, [edits]);

  // File input change handler
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="App">
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Book CSV Editor</h1>
            <p className="text-gray-600">Upload, edit, and manage your book collection</p>
          </header>

          {/* File Handler Section */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600 transition-colors">
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={() => handleGenerateData(10000)}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
              >
                Generate 10k Sample Data
              </button>
              
              <button
                onClick={handleDownloadCSV}
                disabled={currentData.length === 0}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                Download CSV
              </button>
              
              <button
                onClick={handleResetEdits}
                disabled={edits.size === 0}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Reset All Edits
              </button>
            </div>
          </div>

          {loading && (
            <div className="bg-white p-4 rounded-lg shadow-md mb-4 text-center">
              <div className="animate-pulse text-gray-600">Loading data...</div>
            </div>
          )}

          {currentData.length > 0 && (
            <>
              {/* Filters Section */}
              <div className="bg-white p-4 rounded-lg shadow-md mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Global Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Global Search
                    </label>
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Search across all columns..."
                      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Genre Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Genre
                    </label>
                    <select
                      value={filterGenre}
                      onChange={(e) => setFilterGenre(e.target.value)}
                      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Genres</option>
                      {genres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Year Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Published Year
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={yearRange.min}
                        onChange={(e) => setYearRange(prev => ({ 
                          ...prev, 
                          min: parseInt(e.target.value) || 0 
                        }))}
                        placeholder="From"
                        min={yearRangeValues.min}
                        max={yearRangeValues.max}
                        className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        value={yearRange.max}
                        onChange={(e) => setYearRange(prev => ({ 
                          ...prev, 
                          max: parseInt(e.target.value) || 9999 
                        }))}
                        placeholder="To"
                        min={yearRangeValues.min}
                        max={yearRangeValues.max}
                        className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex items-end">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showOnlyEdited}
                        onChange={(e) => setShowOnlyEdited(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show only edited rows</span>
                    </label>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
                  <div>
                    Total records: {currentData.length} | 
                    Filtered: {filteredData.length} | 
                    Edited: {edits.size}
                  </div>
                  <div>
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        {columns.map(column => (
                          <th 
                            key={column}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => handleSort(column)}
                          >
                            <div className="flex items-center space-x-1">
                              <span>{column}</span>
                              {sortConfig.key === column && (
                                <span className="text-lg">
                                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedData.map((row, index) => {
                        const absoluteIndex = startIndex + index;
                        const rowEdited = isRowEdited(absoluteIndex);
                        
                        return (
                          <tr 
                            key={absoluteIndex} 
                            className={rowEdited ? 'bg-yellow-50' : 'hover:bg-gray-50 transition-colors'}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {absoluteIndex + 1}
                            </td>
                            {columns.map(column => {
                              const cellEdited = isCellEdited(absoluteIndex, column);
                              
                              return (
                                <td key={column} className="px-6 py-4 whitespace-nowrap">
                                  <input
                                    value={row[column] || ''}
                                    onChange={(e) => handleCellEdit(absoluteIndex, column, e.target.value)}
                                    className={`w-full p-2 border rounded text-sm transition-colors ${
                                      cellEdited 
                                        ? 'bg-yellow-100 border-yellow-400 focus:border-yellow-500' 
                                        : 'border-gray-300 focus:border-blue-500'
                                    } focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
                                      cellEdited ? 'focus:ring-yellow-500' : 'focus:ring-blue-500'
                                    }`}
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
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 p-4 bg-white rounded-lg shadow-md">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
                    {currentData.length !== filteredData.length && ` (filtered from ${currentData.length} total)`}
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                      className="border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex space-x-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded border text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      First
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded border text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = currentPage <= 3 
                        ? i + 1 
                        : currentPage >= totalPages - 2 
                          ? totalPages - 4 + i 
                          : currentPage - 2 + i;
                      
                      if (pageNum < 1 || pageNum > totalPages) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded border text-sm transition-colors ${
                            currentPage === pageNum 
                              ? 'bg-blue-500 text-white border-blue-500' 
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded border text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded border text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && currentData.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default App;