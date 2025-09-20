import { Request, Response } from 'express';
import { LookupService } from '../../services/customers/lookupService';

export class LookupController {
  static async getLedTypes(req: Request, res: Response) {
    try {
      const ledTypes = await LookupService.getLedTypes();
      res.json(ledTypes);
    } catch (error) {
      console.error('Error fetching LED types:', error);
      res.status(500).json({ error: 'Failed to fetch LED types' });
    }
  }

  static async getPowerSupplyTypes(req: Request, res: Response) {
    try {
      const powerSupplyTypes = await LookupService.getPowerSupplyTypes();
      res.json(powerSupplyTypes);
    } catch (error) {
      console.error('Error fetching Power Supply types:', error);
      res.status(500).json({ error: 'Failed to fetch Power Supply types' });
    }
  }

  static async getTaxInfoByProvince(req: Request, res: Response) {
    try {
      const province = req.params.province;
      const taxInfo = await LookupService.getTaxInfoByProvince(province);
      
      if (!taxInfo) {
        return res.status(404).json({ error: 'Tax information not found for province' });
      }
      
      res.json(taxInfo);
    } catch (error) {
      console.error('Error fetching tax info:', error);
      res.status(500).json({ error: 'Failed to fetch tax information' });
    }
  }

  static async getAllProvincesTaxInfo(req: Request, res: Response) {
    try {
      const provincesData = await LookupService.getAllProvincesTaxInfo();
      res.json(provincesData);
    } catch (error) {
      console.error('Error fetching provinces tax data:', error);
      res.status(500).json({ error: 'Failed to fetch provinces tax data' });
    }
  }

  static async getProvincesStates(req: Request, res: Response) {
    try {
      const provincesStates = await LookupService.getProvincesStates();
      res.json(provincesStates);
    } catch (error) {
      console.error('Error fetching provinces/states:', error);
      res.status(500).json({ error: 'Failed to fetch provinces/states' });
    }
  }
}