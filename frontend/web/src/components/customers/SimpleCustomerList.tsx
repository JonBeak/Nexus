import React from 'react';
import { useCustomerAPI } from './hooks/useCustomerAPI';
import { useCustomerListData } from './hooks/useCustomerListData';
import { useCustomerListFiltering } from './hooks/useCustomerListFiltering';
import { CustomerListHeader } from './components/CustomerListHeader';
import { CustomerTable } from './components/CustomerTable';
import CustomerDetailsModal from './CustomerDetailsModal';
import { CustomerCreationModal } from './CustomerCreationModal';

function SimpleCustomerList() {
  // Custom hooks for business logic
  const { ledTypes, powerSupplyTypes } = useCustomerAPI();
  const {
    searchTerm,
    showDeactivatedCustomers,
    setSearchTerm,
    setShowDeactivatedCustomers,
    handleSearch,
    handleClearSearch,
    getActiveCustomerCount
  } = useCustomerListFiltering();
  
  const {
    customers,
    selectedCustomer,
    showCustomerDetails,
    showAddCustomerModal,
    loading,
    error,
    setShowAddCustomerModal,
    refreshCustomers,
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
  const handleDetailsClick = async (customer: any) => {
    await handleCustomerDetails(customer);
  };

  const handleReactivateClick = async (customerId: number) => {
    await handleReactivateCustomer(customerId, searchTerm);
  };

  const handleCustomerCreatedCallback = (newCustomer: any) => {
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
      
      <div className="min-h-screen bg-gray-100">
        <CustomerListHeader
          activeCustomerCount={getActiveCustomerCount(customers)}
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