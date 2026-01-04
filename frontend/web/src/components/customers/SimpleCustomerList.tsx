import React from 'react';
import { useCustomerAPI } from './hooks/useCustomerAPI';
import { useCustomerListData } from './hooks/useCustomerListData';
import { useCustomerListFiltering } from './hooks/useCustomerListFiltering';
import { CustomerListHeader } from './components/CustomerListHeader';
import { CustomerTable } from './components/CustomerTable';
import CustomerDetailsModal from './CustomerDetailsModal';
import { CustomerCreationModal } from './CustomerCreationModal';
import { Customer } from '../../types';
import { PAGE_STYLES } from '../../constants/moduleColors';
import '../jobEstimation/JobEstimation.css';

function SimpleCustomerList() {
  // Custom hooks for business logic
  const { ledTypes, powerSupplyTypes } = useCustomerAPI();
  const {
    searchTerm,
    showDeactivatedCustomers,
    setSearchTerm,
    setShowDeactivatedCustomers,
    handleSearch,
    handleClearSearch
  } = useCustomerListFiltering();
  
  const {
    customers,
    selectedCustomer,
    showCustomerDetails,
    showAddCustomerModal,
    loading,
    error,
    pagination,
    currentPage,
    setShowAddCustomerModal,
    refreshCustomers,
    handlePageChange,
    handleCustomerDetails,
    handleReactivateCustomer,
    handleCustomerCreated,
    handleCloseCustomerDetails
  } = useCustomerListData(searchTerm, showDeactivatedCustomers);

  // Search handlers with hooks integration
  const handleSearchSubmit = (e: React.FormEvent) => {
    handleSearch(e, (search) => refreshCustomers(search, showDeactivatedCustomers));
  };

  const handleClearSearchClick = () => {
    handleClearSearch((search) => refreshCustomers(search, showDeactivatedCustomers));
  };

  // Customer action handlers
  const handleDetailsClick = async (customer: Customer) => {
    await handleCustomerDetails(customer);
  };

  const handleReactivateClick = async (customerId: number) => {
    await handleReactivateCustomer(customerId, searchTerm);
  };

  const handleCustomerCreatedCallback = (newCustomer: Customer) => {
    handleCustomerCreated(newCustomer, searchTerm);
  };

  const handleCloseCustomerDetailsCallback = async () => {
    await handleCloseCustomerDetails(searchTerm);
  };

  return (
    <>
      {/* Customer Details Modal */}
      {showCustomerDetails && (
        <CustomerDetailsModal 
          customer={selectedCustomer} 
          onClose={handleCloseCustomerDetailsCallback}
        />
      )}
      
      <div className={PAGE_STYLES.fullPage}>
        <CustomerListHeader
          activeCustomerCount={pagination.total}
          showDeactivatedCustomers={showDeactivatedCustomers}
          setShowDeactivatedCustomers={setShowDeactivatedCustomers}
          onAddCustomerClick={() => setShowAddCustomerModal(true)}
        />

        <CustomerTable
          customers={customers}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onSearch={handleSearchSubmit}
          onClearSearch={handleClearSearchClick}
          onCustomerDetails={handleDetailsClick}
          onReactivateCustomer={handleReactivateClick}
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={handlePageChange}
        />
      
      {/* Add Customer Modal */}
      <CustomerCreationModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onCustomerCreated={handleCustomerCreatedCallback}
        ledTypes={ledTypes}
        powerSupplyTypes={powerSupplyTypes}
        showNotification={(message, type) => {
          if (type === 'error') {
            console.error(message);
            alert(message);
          } else {
            console.log(message);
          }
        }}
      />

    </div>
    </>
  );
}

export default SimpleCustomerList;
